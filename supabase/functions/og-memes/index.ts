// Supabase Edge Function: og-memes
// Fetches post IDs from the public @ogmemesroom Telegram channel page server-side,
// avoiding CORS entirely. The React frontend then embeds each post via the official
// Telegram post widget (telegram-widget.js), which handles document/image display.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const before = url.searchParams.get("before") || "";
    const channel = "ogmemesroom";

    const tgUrl = before
      ? `https://t.me/s/${channel}?before=${before}`
      : `https://t.me/s/${channel}`;

    const res = await fetch(tgUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      throw new Error(`Telegram returned ${res.status}`);
    }

    const html = await res.text();

    // Extract post IDs
    const postIdMatches = [...html.matchAll(/data-post="ogmemesroom\/(\d+)"/g)];
    const postIds = postIdMatches
      .map((m) => parseInt(m[1], 10))
      .filter((n) => !isNaN(n))
      .sort((a, b) => b - a); // newest first

    // Extract per-post metadata (date, views, document name) for richer cards
    const posts: Array<{
      id: number;
      link: string;
      date: string | null;
      views: number | null;
      docName: string | null;
    }> = [];

    // Split HTML by message wrap to parse individual post metadata
    const msgRegex =
      /<div class="tgme_widget_message_wrap[^"]*">([\s\S]*?)(?=<div class="tgme_widget_message_wrap|<\/section>)/g;
    let msgMatch: RegExpExecArray | null;

    while ((msgMatch = msgRegex.exec(html)) !== null) {
      const block = msgMatch[1];

      const idMatch = block.match(/data-post="ogmemesroom\/(\d+)"/);
      if (!idMatch) continue;
      const id = parseInt(idMatch[1], 10);

      const dateMatch = block.match(/datetime="([^"]+)"/);
      const viewsMatch = block.match(
        /tgme_widget_message_views[^>]*>([\d.,KM]+)/
      );
      const docMatch = block.match(
        /tgme_widget_message_document_title[^>]+>([^<]+)/
      );

      posts.push({
        id,
        link: `https://t.me/${channel}/${id}`,
        date: dateMatch ? dateMatch[1] : null,
        views: viewsMatch
          ? parseInt(viewsMatch[1].replace(/[,. ]/g, ""), 10) || null
          : null,
        docName: docMatch ? docMatch[1].trim() : null,
      });
    }

    // Sort newest first
    posts.sort((a, b) => b.id - a.id);

    // Find the oldest ID in the page for pagination
    const minId = postIds.length > 0 ? Math.min(...postIds) : null;

    return new Response(
      JSON.stringify({
        channel,
        posts,
        postIds,
        nextBefore: minId, // pass as ?before= for the next page
        total: posts.length,
      }),
      {
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60", // cache 60s at CDN
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
