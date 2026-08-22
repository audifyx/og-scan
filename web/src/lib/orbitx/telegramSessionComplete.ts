/** Notify the official Telegram bot after a real on-chain launch / mint. */

export type TelegramSessionCompleteInput = {
  telegramUserId?: string | null;
  telegramChatId?: string | null;
  nonce?: string | null;
  kind: "token" | "nft";
  mint: string;
  signature: string;
  name?: string;
  symbol?: string;
  metadataUri?: string;
  feePaid?: boolean;
  orbitxBurnSignature?: string;
};

export async function notifyTelegramSessionComplete(input: TelegramSessionCompleteInput): Promise<void> {
  const telegramUserId = String(input.telegramUserId || "").trim();
  const mint = String(input.mint || "").trim();
  const signature = String(input.signature || "").trim();
  if (!telegramUserId || !mint || !signature) return;
  try {
    await fetch("/api/telegram-orbitx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "web.sessionComplete",
        telegramUserId,
        chatId: input.telegramChatId || undefined,
        nonce: input.nonce || undefined,
        kind: input.kind,
        mint,
        signature,
        name: input.name,
        symbol: input.symbol,
        metadataUri: input.metadataUri,
        feePaid: input.feePaid,
        orbitxBurnSignature: input.orbitxBurnSignature,
      }),
    });
  } catch {
    /* bot notify is best-effort — user can still paste Solscan */
  }
}
