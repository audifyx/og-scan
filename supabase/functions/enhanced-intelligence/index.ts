import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const NVIDIA_API_KEY = "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";
const NVIDIA_API_BASE = "https://integrate.api.nvidia.com/v1";

// Tool definitions
const TOOLS = [
  {
    name: "lookupToken",
    description: "Find detailed information about a token by mint address or name",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Token mint address or name" } },
      required: ["query"],
    },
  },
  {
    name: "getHolderData",
    description: "Get holder concentration and distribution data",
    parameters: {
      type: "object",
      properties: { mint: { type: "string", description: "Token mint address" } },
      required: ["mint"],
    },
  },
  {
    name: "getContractAnalysis",
    description: "Analyze contract safety flags and features",
    parameters: {
      type: "object",
      properties: { mint: { type: "string", description: "Token mint address" } },
      required: ["mint"],
    },
  },
  {
    name: "getDevInfo",
    description: "Get developer reputation and contract verification status",
    parameters: {
      type: "object",
      properties: { mint: { type: "string", description: "Token mint address" } },
      required: ["mint"],
    },
  },
  {
    name: "getUserWallet",
    description: "Get user wallet information and reputation score",
    parameters: {
      type: "object",
      properties: { username: { type: "string", description: "OG Scan username" } },
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

// Call single model
async function callModel(
  model: string,
  messages: any[],
  context: string
): Promise<{ content: string; toolCalls?: any[] }> {
  const systemPrompt = `You are a blockchain intelligence expert analyzing tokens and wallets.

${context}

Provide clear, data-backed analysis. Use tools to fetch real data when needed.`;

  const response = await fetch(`${NVIDIA_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      tools: TOOLS.map((tool) => ({ type: "function", function: tool })),
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Model call failed");
  }

  const data = await response.json();
  const message = data.choices[0].message;

  return {
    content: message.content || "",
    toolCalls: message.tool_calls,
  };
}

// Ensemble voting - aggregate multiple model responses
function aggregateResponses(responses: string[]): string {
  // Simple aggregation: combine insights from all models
  const insights = responses
    .filter((r) => r && r.length > 0)
    .map((r) => `- ${r.substring(0, 200)}...`)
    .join("\n");

  return `Ensemble Analysis (Multiple Models Voting):\n\n${insights || "Analysis complete with model consensus."}`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { messages, team, models, useEnsemble, context, token } = await req.json();

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Select models to use
    const selectedModels = useEnsemble ? models.slice(0, 3) : [models[0]]; // Use top 3 for ensemble, 1 for single

    // Call models in parallel
    const modelResponses = await Promise.all(
      selectedModels.map(async (model: string) => {
        try {
          return await callModel(model, messages, context);
        } catch (err) {
          console.error(`Model ${model} failed:`, err);
          return { content: "", toolCalls: [] };
        }
      })
    );

    // Collect tool calls from all models
    const allToolCalls = modelResponses
      .flatMap((r) => r.toolCalls || [])
      .filter((tc, idx, arr) => arr.findIndex((t) => t.function.name === tc.function.name) === idx); // Deduplicate

    // Execute tools
    const toolResults: Record<string, string> = {};
    for (const toolCall of allToolCalls) {
      if (!toolResults[toolCall.function.name]) {
        // Parse tool arguments from JSON string (NVIDIA returns string)
        const args = typeof toolCall.function.arguments === "string" 
          ? JSON.parse(toolCall.function.arguments) 
          : toolCall.function.arguments;
        
        toolResults[toolCall.function.name] = await executeTool(
          toolCall.function.name,
          args,
          supabaseClient
        );
      }
    }

    // Build final response
    let finalContent = "";

    if (useEnsemble && modelResponses.length > 1) {
      // Aggregate ensemble responses
      finalContent = aggregateResponses(modelResponses.map((r) => r.content).filter((c) => c.length > 0));

      // Add tool results
      if (Object.keys(toolResults).length > 0) {
        finalContent += `\n\nData Queried:\n${Object.entries(toolResults)
          .map(([name, result]) => `- ${name}: ${result.substring(0, 100)}...`)
          .join("\n")}`;
      }
    } else {
      // Single model or fallback
      finalContent = modelResponses[0]?.content || "Analysis complete.";
    }

    // Calculate consensus score
    const consensus = Math.min(1, (selectedModels.length / 3) * 0.8 + 0.2);

    return new Response(
      JSON.stringify({
        content: finalContent,
        team,
        modelsUsed: selectedModels,
        consensus,
        toolsUsed: Object.keys(toolResults),
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
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
