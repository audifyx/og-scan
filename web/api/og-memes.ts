/**
 * Vercel Serverless Function: /api/og-memes
 *
 * Fetches the public Telegram channel page (t.me/s/ogmemesroom) server-side
 * (no CORS issues) and returns real post IDs + metadata as JSON.
 *
 * The React frontend calls this endpoint, then renders each post via the
 * official Telegram post widget which handles document/.webp display.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

const CHANNEL = "ogmemesroom";

interface TgPost {
  id: number;
  link: string;
  date: string | null;
  views: number | null;
  docName: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    const before = req.query.before ? String(req.query.before) : "";
    const tgUrl = before
      ? `https://t.me/s/${CHANNEL}?before=${before}`
      : `https://t.me/s/${CHANNEL}`;

    const tgRes = await fetch(tgUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!tgRes.ok) {
      throw new Error(`Telegram returned ${tgRes.status}`);
    }

    const html = await tgRes.text();

    // ── Parse post blocks ────────────────────────────────────────────────────
    const posts: TgPost[] = [];

    // Split by message wrap to get per-post HTML
    const msgRegex =
      /<div class="tgme_widget_message_wrap[^"]*">([\s\S]*?)(?=<div class="tgme_widget_message_wrap|<\/section>)/g;
    let m: RegExpExecArray | null;

    while ((m = msgRegex.exec(html)) !== null) {
      const block = m[1];

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
        link: `https://t.me/${CHANNEL}/${id}`,
        date: dateMatch ? dateMatch[1] : null,
        views: viewsMatch
          ? parseInt(viewsMatch[1].replace(/[,. ]/g, ""), 10) || null
          : null,
        docName: docMatch ? docMatch[1].trim() : null,
      });
    }

    // Sort newest first
    posts.sort((a, b) => b.id - a.id);

    const minId = posts.length > 0 ? Math.min(...posts.map((p) => p.id)) : null;

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    res.status(200).json({
      channel: CHANNEL,
      posts,
      postIds: posts.map((p) => p.id),
      nextBefore: minId,
      total: posts.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[og-memes]", message);
    res.status(500).json({ error: message, posts: [], postIds: [] });
  }
}
