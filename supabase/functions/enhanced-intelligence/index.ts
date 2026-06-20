import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// NVIDIA NIM (OpenAI-compatible). Key/model come from env, with safe fallbacks.
const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY") || "";
const NVIDIA_API_BASE = Deno.env.get("NVIDIA_BASE_URL") || "https://integrate.api.nvidia.com/v1";
// llama-3.1-405b is NOT available on the free tier (404); 3.3-70b is the best working default.
const MODEL = Deno.env.get("NVIDIA_MODEL") || "meta/llama-3.3-70b-instruct";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Tool definitions
const TOOLS = [
  {
    name: "lookupToken",
    description: "Find token info by mint address",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "getHolderData",
    description: "Get holder distribution data",
    parameters: {
      type: "object",
      properties: { mint: { type: "string" } },
      required: ["mint"],
    },
  },
];

async function executeTool(toolName: string, params: any, supabase: any): Promise<string> {
  try {
    if (toolName === "lookupToken") {
      const { data } = await supabase
        .from("tokens")
        .select("*")
        .or(`mint.eq.${params.query},name.ilike.%${params.query}%,symbol.ilike.%${params.query}%`)
        .limit(1)
        .maybeSingle();

      if (!data) return JSON.stringify({ error: "Token not found" });
      return JSON.stringify({
        mint: data.mint,
        name: data.name,
        symbol: data.symbol,
        price: data.current_price,
        marketCap: data.market_cap,
        holders: data.holders_count,
      });
    }

    if (toolName === "getHolderData") {
      const { data } = await supabase
        .from("tokens")
        .select("holders_count, top_10_holders_pct")
        .eq("mint", params.mint)
        .maybeSingle();

      if (!data) return JSON.stringify({ error: "Token not found" });
      return JSON.stringify({
        total: data.holders_count,
        top10Percent: data.top_10_holders_pct,
      });
    }

    return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
  }
}

async function callNvidia(payload: Record<string, unknown>) {
  const res = await fetch(`${NVIDIA_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch { /* non-JSON error body */ }
  return { ok: res.ok, status: res.status, parsed, text };
}

Deno.serve(async (req: Request) => {
  // CORS preflight — MUST return CORS headers or browsers block everything.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    if (!NVIDIA_API_KEY) {
      return json({ error: "NVIDIA_API_KEY not configured" }, 500);
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const { messages, context } = body || {};
    if (!messages || !Array.isArray(messages)) {
      return json({ error: "messages required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const systemPrompt = `You are a blockchain intelligence expert.${
      context ? `\n\nContext:\n${context}` : ""
    }\n\nProvide clear, data-backed analysis.`;

    const baseMessages = [{ role: "system", content: systemPrompt }, ...messages];

    // Try with tools first; if the model/endpoint rejects tools, retry without them.
    let result = await callNvidia({
      model: MODEL,
      messages: baseMessages,
      tools: TOOLS.map((t) => ({ type: "function", function: t })),
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 1024,
    });

    let toolsUsed: string[] = [];

    if (!result.ok) {
      // Retry without tools (covers models that don't support function calling)
      result = await callNvidia({
        model: MODEL,
        messages: baseMessages,
        temperature: 0.7,
        max_tokens: 1024,
      });
    }

    if (!result.ok) {
      const msg = result.parsed?.error?.message || result.text || `NVIDIA error ${result.status}`;
      return json({ error: `Model error: ${msg}` }, 502);
    }

    const message = result.parsed?.choices?.[0]?.message;
    if (!message) {
      return json({ error: "No response from model" }, 502);
    }

    let finalContent = message.content || "";

    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolResults: Record<string, string> = {};
      for (const toolCall of message.tool_calls) {
        try {
          const args =
            typeof toolCall.function.arguments === "string"
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments;
          toolsUsed.push(toolCall.function.name);
          toolResults[toolCall.function.name] = await executeTool(
            toolCall.function.name,
            args,
            supabase,
          );
        } catch (_e) {
          /* skip malformed tool call */
        }
      }
      if (Object.keys(toolResults).length > 0) {
        finalContent += `\n\nData fetched:\n${Object.entries(toolResults)
          .map(([name, r]) => `${name}: ${r}`)
          .join("\n")}`;
      }
    }

    return json({
      content: finalContent || "No analysis returned.",
      model: MODEL,
      modelsUsed: [MODEL],
      consensus: 0.8,
      toolsUsed,
    });
  } catch (error: any) {
    console.error("enhanced-intelligence error:", error);
    return json({ error: error?.message || "Internal server error" }, 500);
  }
});
