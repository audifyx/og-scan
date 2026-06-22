import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY") || "";
const NVIDIA_API_BASE = "https://integrate.api.nvidia.com/v1";

// Tool definitions for AI to use
const TOOLS = [
  {
    name: "lookupToken",
    description: "Find detailed information about a token by mint address or name",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Token mint address or name" },
      },
      required: ["query"],
    },
  },
  {
    name: "getHolderData",
    description: "Get holder concentration and distribution data",
    parameters: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint address" },
      },
      required: ["mint"],
    },
  },
  {
    name: "getContractAnalysis",
    description: "Analyze contract safety flags and features",
    parameters: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint address" },
      },
      required: ["mint"],
    },
  },
  {
    name: "getDevInfo",
    description: "Get developer reputation and contract verification status",
    parameters: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint address" },
      },
      required: ["mint"],
    },
  },
  {
    name: "getUserWallet",
    description: "Get user wallet information and reputation score",
    parameters: {
      type: "object",
      properties: {
        username: { type: "string", description: "OG Scan username" },
      },
      required: ["username"],
    },
  },
];

// Execute tools
async function executeTool(
  toolName: string,
  params: Record<string, string>,
  supabaseClient: any
): Promise<string> {
  try {
    switch (toolName) {
      case "lookupToken": {
        const { data } = await supabaseClient
          .from("tokens")
          .select("*")
          .or(`mint.eq.${params.query},name.ilike.%${params.query}%,symbol.ilike.%${params.query}%`)
          .limit(1)
          .single();

        if (!data) return JSON.stringify({ error: "Token not found" });
        return JSON.stringify({
          mint: data.mint,
          name: data.name,
          symbol: data.symbol,
          price: data.current_price,
          marketCap: data.market_cap,
          holders: data.holders_count,
          created: data.created_at,
          deployer: data.deployer,
        });
      }

      case "getHolderData": {
        const { data } = await supabaseClient
          .from("tokens")
          .select("holders_count, top_10_holders_pct, holder_growth_24h")
          .eq("mint", params.mint)
          .single();

        if (!data) return JSON.stringify({ error: "Token not found" });
        return JSON.stringify({
          totalHolders: data.holders_count,
          top10Percent: data.top_10_holders_pct,
          growth24h: data.holder_growth_24h,
        });
      }

      case "getContractAnalysis": {
        const { data } = await supabaseClient
          .from("tokens")
          .select("contract_verified, contract_renounced, liquidity_locked, honeypot_detected, recent_mint_detected")
          .eq("mint", params.mint)
          .single();

        if (!data) return JSON.stringify({ error: "Token not found" });
        return JSON.stringify({
          verified: data.contract_verified,
          renounced: data.contract_renounced,
          lpLocked: data.liquidity_locked,
          honeypot: data.honeypot_detected,
          recentMint: data.recent_mint_detected,
        });
      }

      case "getDevInfo": {
        const { data } = await supabaseClient
          .from("tokens")
          .select("deployer, developer_reputation, contract_verified")
          .eq("mint", params.mint)
          .single();

        if (!data) return JSON.stringify({ error: "Token not found" });
        return JSON.stringify({
          address: data.deployer,
          reputation: data.developer_reputation || "Unknown",
          contractVerified: data.contract_verified,
        });
      }

      case "getUserWallet": {
        const { data } = await supabaseClient
          .from("profiles")
          .select("sol_wallet, username, og_score, reputation_score")
          .eq("username", params.username)
          .single();

        if (!data) return JSON.stringify({ error: "User not found" });
        return JSON.stringify({
          wallet: data.sol_wallet,
          username: data.username,
          score: data.og_score,
          reputation: data.reputation_score,
        });
      }

      default:
        return JSON.stringify({ error: "Unknown tool" });
    }
  } catch (error: any) {
    return JSON.stringify({ error: error.message });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { messages, model, context } = await req.json();

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Build messages with tools
    const systemPrompt = `You are an intelligent blockchain analyst connected to real token and wallet data.

You have access to these tools to fetch accurate data:
${JSON.stringify(TOOLS, null, 2)}

When the user asks about a token, wallet, or contract:
1. Use the appropriate tools to fetch real data
2. Analyze the data and provide insights
3. Highlight red flags and positive signals
4. Be conversational and engaging - feel like you're talking WITH the token/wallet, not about it

Context: ${context || "General blockchain analysis"}

Always fetch data before responding with analysis. If a tool call returns an error, let the user know.`;

    let conversationMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Tool-enabled loop (up to 5 iterations)
    for (let i = 0; i < 5; i++) {
      const response = await fetch(`${NVIDIA_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${NVIDIA_API_KEY}`,
        },
        body: JSON.stringify({
          model: model || "meta/llama-3.3-70b-instruct",
          messages: conversationMessages,
          tools: TOOLS.map((tool) => ({
            type: "function",
            function: tool,
          })),
          tool_choice: "auto",
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return new Response(
          JSON.stringify({
            error: error.error?.message || "API request failed",
          }),
          { status: response.status, headers: { "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      const assistantMessage = data.choices[0].message;

      // Check if tool was called
      if (assistantMessage.tool_calls) {
        conversationMessages.push(assistantMessage);

        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          const toolResult = await executeTool(toolCall.function.name, toolCall.function.arguments, supabaseClient);

          conversationMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }
      } else {
        // No more tool calls, return final response
        return new Response(
          JSON.stringify({
            content: assistantMessage.content,
            model: model,
            toolsUsed: conversationMessages.filter((m) => m.role === "tool").length > 0,
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Max tool iterations reached: make one final call WITHOUT tools to force a text answer.
    const finalResp = await fetch(`${NVIDIA_API_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` },
      body: JSON.stringify({
        model: model || "meta/llama-3.3-70b-instruct",
        messages: conversationMessages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });
    const finalData = await finalResp.json();
    const finalContent = finalData?.choices?.[0]?.message?.content || "I could not complete that request.";
    return new Response(
      JSON.stringify({ content: finalContent, model: model, toolsUsed: true }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
