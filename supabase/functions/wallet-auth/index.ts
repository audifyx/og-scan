// OrbitX wallet-auth — Sign-In-With-Solana + one-time legacy account merge.
//
// actions:
//  - nonce  {pubkey}                      -> { nonce, message }
//  - verify {pubkey, signature(b58)}      -> { access_token, refresh_token, isNew, user }
//  - merge  {email, password}  (Bearer wallet session) -> { ok, result }
//
// Session issuance keeps auth.uid() intact: each wallet maps to a real auth
// user. We mint a session via generateLink + verifyOtp (password grant is the
// fallback) so a hung GoTrue /token endpoint cannot block wallet login.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nacl from "npm:tweetnacl@1.0.3";
import bs58 from "npm:bs58@5.0.0";
import { authCors } from "../_shared/auth_cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = () => createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const json = (headers: Record<string, string>, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const walletEmail = (pk: string) => `${pk.toLowerCase()}@wallet.orbitx.app`;
const randPass = () => bs58.encode(crypto.getRandomValues(new Uint8Array(32)));
const NONCE_TTL_MS = 5 * 60_000;

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function nonceMac(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SERVICE_ROLE),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
}

function buildMessage(pubkey: string, nonce: string) {
  return `OrbitX — sign in with your wallet.\n\nWallet: ${pubkey}\nNonce: ${nonce}\n\nThis request will not trigger a transaction or cost any fees.`;
}

async function consumeNonce(
  db: ReturnType<typeof admin>,
  nonce: string,
  pubkey: string,
) {
  const { error } = await db.from("wallet_auth_used_nonces").insert({ nonce, pubkey });
  if (!error) return;
  const code = (error as { code?: string }).code || "";
  const msg = error.message || "";
  if (code === "23505" || /duplicate|unique/i.test(msg)) {
    throw new Error("nonce already used — reconnect and try again");
  }
  if (code === "42P01" || /does not exist|schema cache/i.test(msg)) return;
  throw new Error("could not record login nonce");
}

async function mintWalletSession(loginEmail: string, userId: string) {
  const db = admin();
  const anonClient = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data: link } = await db.auth.admin.generateLink({ type: "magiclink", email: loginEmail });
  const hashed = link?.properties?.hashed_token;
  if (hashed) {
    for (const type of ["magiclink", "email"] as const) {
      const { data: sess, error } = await anonClient.auth.verifyOtp({ type, token_hash: hashed });
      if (!error && sess.session) return sess.session;
    }
  }
  const pass = randPass();
  const { error: updErr } = await db.auth.admin.updateUserById(userId, { password: pass });
  if (updErr) throw updErr;
  const { data: sess, error: sErr } = await anonClient.auth.signInWithPassword({ email: loginEmail, password: pass });
  if (sErr || !sess.session) throw new Error(sErr?.message || "session issue failed");
  return sess.session;
}

async function resolveExistingWalletUser(email0: string): Promise<string | null> {
  const { data: link } = await admin().auth.admin.generateLink({ type: "magiclink", email: email0 });
  return link?.user?.id ?? null;
}

Deno.serve(async (req) => {
  const headers = authCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json(headers, { error: "method_not_allowed" }, 405);
  try {
    const { action, pubkey, signature, nonce, email, password } = await req.json();
    const db = admin();

    if (action === "nonce") {
      const walletKey = typeof pubkey === "string" ? pubkey.trim() : "";
      if (!walletKey) throw new Error("pubkey required");
      const issuedAt = Date.now();
      const random = crypto.randomUUID();
      const payload = `${issuedAt}.${random}.${walletKey}`;
      const nextNonce = `${issuedAt}.${random}.${await nonceMac(payload)}`;
      return json(headers, { nonce: nextNonce, message: buildMessage(walletKey, nextNonce) });
    }

    if (action === "verify") {
      const walletKey = typeof pubkey === "string" ? pubkey.trim() : "";
      if (!walletKey || !signature || typeof nonce !== "string" || !nonce) throw new Error("pubkey, nonce, and signature required");
      const parts = nonce.split(".");
      if (parts.length !== 3) throw new Error("invalid nonce — request a new one");
      const issuedAt = Number(parts[0]);
      const random = parts[1];
      const mac = parts[2];
      if (!Number.isFinite(issuedAt) || Date.now() - issuedAt < 0 || Date.now() - issuedAt > NONCE_TTL_MS) throw new Error("nonce expired — request a new one");
      const expectedMac = await nonceMac(`${issuedAt}.${random}.${walletKey}`);
      if (mac !== expectedMac) throw new Error("invalid nonce — request a new one");
      const ok = nacl.sign.detached.verify(
        new TextEncoder().encode(buildMessage(walletKey, nonce)),
        bs58.decode(signature),
        bs58.decode(walletKey),
      );
      if (!ok) throw new Error("invalid signature");
      await consumeNonce(db, nonce, walletKey);

      let userId: string | null = null;
      let isNew = false;
      const { data: ident } = await db.from("wallet_identities").select("user_id").eq("wallet", walletKey).maybeSingle();
      if (ident?.user_id) {
        userId = ident.user_id;
      } else {
        const email0 = walletEmail(walletKey);
        const created = await db.auth.admin.createUser({
          email: email0,
          password: randPass(),
          email_confirm: true,
          user_metadata: { wallet: walletKey, login: "wallet" },
        });
        if (created.error && !`${created.error.message}`.toLowerCase().includes("already")) throw created.error;
        if (!created.error && created.data?.user?.id) {
          userId = created.data.user.id;
          isNew = true;
        } else {
          userId = created.data?.user?.id ?? await resolveExistingWalletUser(email0);
        }
        if (!userId) throw new Error("could not resolve wallet user");
        await db.from("wallet_identities").upsert({ wallet: walletKey, user_id: userId });
        await db.from("profiles").upsert(
          { user_id: userId, username: walletKey.slice(0, 4) + walletKey.slice(-4) },
          { onConflict: "user_id", ignoreDuplicates: true },
        );
      }

      const { data: u } = await db.auth.admin.getUserById(userId);
      const loginEmail = u.user?.email ?? walletEmail(walletKey);
      const sess = await mintWalletSession(loginEmail, userId);
      return json(headers, {
        access_token: sess.access_token,
        refresh_token: sess.refresh_token,
        isNew,
        user: sess.user,
      });
    }

    if (action === "merge") {
      if (!email || !password) throw new Error("email and password required");
      const authz = req.headers.get("Authorization") || "";
      const token = authz.replace(/^Bearer\s+/i, "");
      if (!token) throw new Error("wallet session required");
      const { data: me, error: meErr } = await db.auth.getUser(token);
      if (meErr || !me?.user?.id) throw new Error("wallet session invalid — reconnect your wallet and try again");
      const newId = me.user.id;

      const verifier = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
      const { data: legacy, error: lErr } = await verifier.auth.signInWithPassword({ email, password });
      if (lErr || !legacy.user) throw new Error("legacy email/password incorrect");
      const oldId = legacy.user.id;
      if (oldId === newId) return json(headers, { ok: true, result: "already this account" });

      const { data: result, error: mErr } = await db.rpc("orbitx_merge_user_data", { p_old: oldId, p_new: newId });
      if (mErr) throw mErr;
      await db.auth.admin.deleteUser(oldId).catch(() => {});
      return json(headers, { ok: true, result });
    }

    throw new Error("unknown action");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message
      : (e && typeof e === "object" && typeof (e as { message?: string }).message === "string")
        ? (e as { message: string }).message
        : "wallet-auth error";
    const safe = /invalid|expired|required|already used|denied|incorrect|unknown action/i.test(msg)
      ? msg
      : "wallet-auth error";
    return json(headers, { error: safe }, 400);
  }
});
