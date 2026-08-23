/**
 * X / Twitter posting policy.
 * User-initiated posts (MCP, app, webhooks) must use THAT user's OAuth token.
 * Never fall back to TWITTER_ACCESS_TOKEN (platform / owner account).
 */

export const X_NOT_CONNECTED_MESSAGE =
  "Connect your own X account. OrbitX will not post as the platform account.";

export function requireUserXAccessToken(accessToken) {
  const token = typeof accessToken === "string" ? accessToken.trim() : "";
  if (!token) {
    return { ok: false, error: "x_not_connected", message: X_NOT_CONNECTED_MESSAGE };
  }
  return { ok: true, accessToken: token };
}

/** Shared secret for internal mention-bot → reply-bot calls. Fail closed if unset. */
export function authorizeReplyBotRequest(headers, secrets) {
  const list = (Array.isArray(secrets) ? secrets : [secrets])
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  if (!list.length) return false;

  const raw = headers && typeof headers === "object" ? headers : {};
  const get = (name) => {
    const key = Object.keys(raw).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? String(raw[key] || "").trim() : "";
  };
  const auth = get("authorization");
  const bearer = /^bearer\s+/i.test(auth) ? auth.replace(/^bearer\s+/i, "").trim() : "";
  const hdr = get("x-orbitx-reply-secret");
  return list.some((secret) => secret === bearer || secret === hdr);
}

export async function uploadImageWithUserOAuth2(accessToken, imageUrl, fetchImpl = fetch) {
  const gate = requireUserXAccessToken(accessToken);
  if (!gate.ok) throw new Error(gate.message);

  const imgRes = await fetchImpl(imageUrl);
  if (!imgRes.ok) throw new Error(`Could not fetch image: ${imgRes.status}`);
  const buf = new Uint8Array(await imgRes.arrayBuffer());
  if (buf.byteLength > 5 * 1024 * 1024) throw new Error("Image exceeds 5MB Twitter limit");
  const contentType = imgRes.headers.get("content-type") || "image/jpeg";

  const boundary = `----ox${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  const enc = new TextEncoder();
  const preamble = enc.encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="media"\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const mid = enc.encode(
    `\r\n--${boundary}\r\nContent-Disposition: form-data; name="media_category"\r\n\r\ntweet_image\r\n--${boundary}--\r\n`,
  );
  const body = new Uint8Array(preamble.length + buf.length + mid.length);
  body.set(preamble, 0);
  body.set(buf, preamble.length);
  body.set(mid, preamble.length + buf.length);

  const url = "https://upload.twitter.com/1.1/media/upload.json";
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gate.accessToken}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Media upload failed: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const mediaId = data?.media_id_string;
  if (!mediaId) throw new Error("No media_id from Twitter");
  return mediaId;
}
