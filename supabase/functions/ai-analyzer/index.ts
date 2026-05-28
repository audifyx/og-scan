import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PRIMARY_GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "llama-3.1-8b-instant";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";
const DEFAULT_MAX_TOKENS = Number(Deno.env.get("AI_MAX_TOKENS") || "1400");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type WalletToken = {
  symbol?: string;
  name?: string;
  balance?: number;
  amount?: number;
  priceUsd?: number;
  usdValue?: number;
  valueUsd?: number;
  interface?: string;
};

type WalletTransaction = {
  timestamp?: number;
  type?: string;
  description?: string;
  source?: string;
  fee?: number;
  tokenTransfers?: Array<{
    mint?: string;
    tokenAmount?: number;
    fromUserAccount?: string;
    toUserAccount?: string;
  }>;
  nativeTransfers?: Array<{
    amount?: number;
    fromUserAccount?: string;
    toUserAccount?: string;
  }>;
};

type ProviderResult = {
  text: string;
  provider: "groq" | "gemini";
  model: string;
};

function getGroqKeys() {
  return [
    Deno.env.get("GROQ_API_KEY"),
    Deno.env.get("GROQ_KEY_1"),
    Deno.env.get("GROQ_KEY_2"),
    Deno.env.get("GROQ_KEY_3"),
    Deno.env.get("GROQ_KEY_4"),
    Deno.env.get("GROQ_KEY_5"),
  ].filter((value): value is string => Boolean(value && value.trim()));
}

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}\n...[truncated]`;
}

function compactNumber(value: unknown) {
  const num = typeof value === "number" ? value : Number(value || 0);
  if (!Number.isFinite(num)) return "0";
  if (Math.abs(num) >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return `${Math.round(num * 100) / 100}`;
}

function summarizeTokens(tokens: WalletToken[] = []) {
  return tokens
    .map((token) => {
      const amount = token.balance ?? token.amount ?? 0;
      const usdValue = token.usdValue ?? token.valueUsd ?? (token.priceUsd || 0) * amount;
      return {
        symbol: token.symbol || token.name || "UNKNOWN",
        amount: Math.round((Number(amount) || 0) * 10000) / 10000,
        usdValue: Math.round((Number(usdValue) || 0) * 100) / 100,
      };
    })
    .sort((a, b) => b.usdValue - a.usdValue)
    .slice(0, 12);
}

function summarizeTransactions(transactions: WalletTransaction[] = []) {
  return transactions.slice(0, 20).map((tx) => {
    const nativeVolume = (tx.nativeTransfers || []).reduce((sum, item) => sum + ((item.amount || 0) / 1e9), 0);
    return {
      timestamp: tx.timestamp || null,
      type: tx.type || "UNKNOWN",
      source: tx.source || null,
      description: tx.description ? truncate(tx.description, 180) : null,
      nativeVolumeSol: Math.round(nativeVolume * 10000) / 10000,
      tokenTransferCount: (tx.tokenTransfers || []).length,
    };
  });
}

function buildWalletPrompt(data: Record<string, unknown>) {
  const walletAddress = String(data.walletAddress || "");
  const tokens = summarizeTokens((data.tokens as WalletToken[]) || []);
  const txs = summarizeTransactions((data.transactions as WalletTransaction[]) || []);

  const stats = {
    totalValueUsd: data.totalValueUsd ?? data.total_value ?? data.total_balance_usd ?? null,
    pnlUsd: data.pnlUsd ?? data.total_pnl ?? null,
    pnlPct: data.pnlPct ?? data.pnl_pct ?? null,
    winRate: data.winRate ?? data.win_rate ?? null,
    tradesCount: data.tradesCount ?? data.trades_count ?? null,
    volumeUsd: data.volumeUsd ?? data.volume_usd ?? null,
    realizedPnlUsd: data.realizedPnlUsd ?? null,
    unrealizedPnlUsd: data.unrealizedPnlUsd ?? null,
  };

  return [
    "You are OG Scan AI, a sharp Solana wallet analyst.",
    "Use only the supplied wallet data. Do not claim live data you were not given.",
    "Be concise, useful, and confident. No disclaimers unless data is clearly missing.",
    "Output markdown with exactly these sections:",
    "## Quick Read",
    "## Wallet Style",
    "## What Stands Out",
    "## Risks",
    "## Actionable Takeaways",
    "Use bullets where helpful.",
    "When data is sparse, say what is missing instead of inventing details.",
    "",
    `Wallet: ${walletAddress}`,
    `Top holdings: ${JSON.stringify(tokens)}`,
    `Recent transactions: ${JSON.stringify(txs)}`,
    `Summary stats: ${JSON.stringify(stats)}`,
  ].join("\n");
}

function sanitizeMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .map((message) => {
      const role = message && typeof message === "object" ? (message as Record<string, unknown>).role : null;
      const content = message && typeof message === "object" ? (message as Record<string, unknown>).content : null;
      if ((role === "user" || role === "assistant" || role === "system") && typeof content === "string" && content.trim()) {
        return {
          role,
          content: truncate(content.trim(), 4000),
        } as ChatMessage;
      }
      return null;
    })
    .filter((value): value is ChatMessage => Boolean(value))
    .slice(-12);
}

async function callGroq(messages: ChatMessage[], maxTokens = DEFAULT_MAX_TOKENS): Promise<ProviderResult> {
  const apiKeys = getGroqKeys();
  if (apiKeys.length === 0) {
    throw new Error("No Groq API keys configured");
  }

  const failures: string[] = [];

  for (const apiKey of apiKeys) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: PRIMARY_GROQ_MODEL,
        temperature: 0.35,
        max_tokens: maxTokens,
        messages,
      }),
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      failures.push(`Groq ${response.status}: ${json?.error?.message || JSON.stringify(json)}`);
      if (response.status === 429 || response.status >= 500) {
        continue;
      }
      throw new Error(failures[failures.length - 1]);
    }

    const text = json?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      failures.push("Groq returned an empty response");
      continue;
    }

    return { text, provider: "groq", model: PRIMARY_GROQ_MODEL };
  }

  throw new Error(failures[failures.length - 1] || "Groq request failed");
}

function messagesToGeminiText(messages: ChatMessage[]) {
  return messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
}

async function callGemini(messages: ChatMessage[], maxTokens = DEFAULT_MAX_TOKENS): Promise<ProviderResult> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("No Gemini API key configured");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: messagesToGeminiText(messages) }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: maxTokens,
        },
      }),
    },
  );

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Gemini ${response.status}: ${json?.error?.message || JSON.stringify(json)}`);
  }

  const text = json?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part?.text || "").join("").trim();
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return { text, provider: "gemini", model: GEMINI_MODEL };
}

async function complete(messages: ChatMessage[], maxTokens = DEFAULT_MAX_TOKENS) {
  try {
    return await callGroq(messages, maxTokens);
  } catch (groqError) {
    console.error("Groq failed, falling back to Gemini:", groqError);
    return await callGemini(messages, maxTokens);
  }
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    throw new Response(JSON.stringify({ error: "missing_auth" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Response(JSON.stringify({ error: "invalid_auth" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return { supabase, user: data.user };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user } = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "chat";

    if (action === "chat") {
      const incomingMessages = sanitizeMessages(body.messages);
      if (incomingMessages.length === 0) {
        return new Response(JSON.stringify({ error: "messages required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const systemPrompt = [
        "You are OG Scan AI, a fast and useful Solana trading assistant inside ogscan.fun.",
        "Focus on Solana tokens, wallets, trading setups, risk, memecoin flow, and practical platform guidance.",
        "Keep answers tight, clear, and actionable.",
        "Do not mention internal model/provider details unless directly asked.",
        "If the user asks something outside crypto/platform context, still help briefly but steer toward practical usefulness.",
      ].join(" ");

      const result = await complete([
        { role: "system", content: systemPrompt },
        ...incomingMessages,
      ], 1000);

      return new Response(JSON.stringify({
        ok: true,
        analysis: result.text,
        provider: result.provider,
        model: result.model,
        userId: user.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "analyzeWallet") {
      const data = body?.data;
      if (!data || typeof data !== "object") {
        return new Response(JSON.stringify({ error: "wallet data required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const prompt = buildWalletPrompt(data as Record<string, unknown>);
      const result = await complete([
        { role: "system", content: "You are a high-signal Solana wallet analyst for OG Scan." },
        { role: "user", content: prompt },
      ], 1400);

      return new Response(JSON.stringify({
        ok: true,
        analysis: result.text,
        provider: result.provider,
        model: result.model,
        walletAddress: String((data as Record<string, unknown>).walletAddress || ""),
        tokenCount: Array.isArray((data as Record<string, unknown>).tokens) ? ((data as Record<string, unknown>).tokens as unknown[]).length : 0,
        transactionCount: Array.isArray((data as Record<string, unknown>).transactions) ? ((data as Record<string, unknown>).transactions as unknown[]).length : 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generateShowNotes") {
      const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
      const spaceTitle = typeof body?.spaceTitle === "string" ? body.spaceTitle.trim() : "Untitled Space";
      if (!transcript) {
        return new Response(JSON.stringify({ error: "transcript required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await complete([
        {
          role: "system",
          content: "You generate clean show notes for OG Scan spaces. Return markdown with sections: Summary, Key Points, Topics, Action Items.",
        },
        {
          role: "user",
          content: `Title: ${spaceTitle}\n\nTranscript:\n${truncate(transcript, 12000)}`,
        },
      ], 1400);

      return new Response(JSON.stringify({ ok: true, analysis: result.text, provider: result.provider, model: result.model }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `unsupported action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Response) return error;

    console.error("ai-analyzer error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
