// OrbitX wallet-auth — Sign-In-With-Solana + one-time legacy account merge.
//
// actions:
//  - nonce  {pubkey}                      -> { nonce, message }
//  - verify {pubkey, signature(b58)}      -> { access_token, refresh_token, isNew }
//  - merge  {email, password}  (Bearer wallet session) -> { ok, result }
//
// Session issuance keeps auth.uid() intact: each wallet maps to a real auth
// user; we set a fresh random password and sign in server-side to mint tokens.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nacl from "npm:tweetnacl@1.0.3";
import bs58 from "npm:bs58@5.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey", "Content-Type": "application/json" };
const admin = () => createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const walletEmail = (pk: string) => `${pk.toLowerCase()}@wallet.orbitx.app`;
const randPass = () => bs58.encode(crypto.getRandomValues(new Uint8Array(32)));

function buildMessage(pubkey: string, nonce: string) {
  return `OrbitX — sign in with your wallet.\n\nWallet: ${pubkey}\nNonce: ${nonce}\n\nThis request will not trigger a transaction or cost any fees.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { action, pubkey, signature, email, password } = await req.json();
    const db = admin();

    if (action === "nonce") {
      if (!pubkey) throw new Error("pubkey required");
      const nonce = crypto.randomUUID();
      const expires_at = new Date(Date.now() + 5 * 60_000).toISOString();
      await db.from("wallet_auth_nonces").upsert({ pubkey, nonce, expires_at });
      return json({ nonce, message: buildMessage(pubkey, nonce) });
    }

    if (action === "verify") {
      if (!pubkey || !signature) throw new Error("pubkey and signature required");
      const { data: row } = await db.from("wallet_auth_nonces").select("nonce, expires_at").eq("pubkey", pubkey).maybeSingle();
      if (!row) throw new Error("no nonce — request one first");
      if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("nonce expired");
      const ok = nacl.sign.detached.verify(
        new TextEncoder().encode(buildMessage(pubkey, row.nonce)),
        bs58.decode(signature),
        bs58.decode(pubkey),
      );
      if (!ok) throw new Error("invalid signature");
      await db.from("wallet_auth_nonces").delete().eq("pubkey", pubkey);

      // resolve or create the wallet's auth user
      let userId: string | null = null;
      let isNew = false;
      const { data: ident } = await db.from("wallet_identities").select("user_id").eq("wallet", pubkey).maybeSingle();
      if (ident?.user_id) {
        userId = ident.user_id;
      } else {
        const email0 = walletEmail(pubkey);
        const created = await db.auth.admin.createUser({ email: email0, password: randPass(), email_confirm: true, user_metadata: { wallet: pubkey, login: "wallet" } });
        if (created.error && !`${created.error.message}`.toLowerCase().includes("already")) throw created.error;
        userId = created.data?.user?.id ?? null;
        if (!userId) {
          // user existed already for this email — look it up
          const list = await db.auth.admin.listUsers();
          userId = list.data.users.find((u) => u.email === email0)?.id ?? null;
        }
        if (!userId) throw new Error("could not resolve wallet user");
        await db.from("wallet_identities").upsert({ wallet: pubkey, user_id: userId });
        await db.from("profiles").upsert({ user_id: userId, username: pubkey.slice(0, 4) + pubkey.slice(-4) }, { onConflict: "user_id", ignoreDuplicates: true });
        isNew = true;
      }

      // mint a session: rotate password, sign in server-side
      const { data: u } = await db.auth.admin.getUserById(userId);
      const loginEmail = u.user?.email ?? walletEmail(pubkey);
      const pass = randPass();
      await db.auth.admin.updateUserById(userId, { password: pass });
      const anonClient = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
      const { data: sess, error: sErr } = await anonClient.auth.signInWithPassword({ email: loginEmail, password: pass });
      if (sErr || !sess.session) throw new Error(sErr?.message || "session issue failed");
      return json({ access_token: sess.session.access_token, refresh_token: sess.session.refresh_token, isNew });
    }

    if (action === "merge") {
      if (!email || !password) throw new Error("email and password required");
      const authz = req.headers.get("Authorization") || "";
      const token = authz.replace(/^Bearer\s+/i, "");
      if (!token) throw new Error("wallet session required");
      const asWallet = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
      const { data: me } = await asWallet.auth.getUser();
      const newId = me.user?.id;
      if (!newId) throw new Error("invalid wallet session");

      // verify legacy credentials
      const verifier = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
      const { data: legacy, error: lErr } = await verifier.auth.signInWithPassword({ email, password });
      if (lErr || !legacy.user) throw new Error("legacy email/password incorrect");
      const oldId = legacy.user.id;
      if (oldId === newId) return json({ ok: true, result: "already this account" });

      const { data: result, error: mErr } = await db.rpc("orbitx_merge_user_data", { p_old: oldId, p_new: newId });
      if (mErr) throw mErr;
      await db.auth.admin.deleteUser(oldId).catch(() => {});
      return json({ ok: true, result });
    }

    throw new Error("unknown action");
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "wallet-auth error" }, 400);
  }
});
