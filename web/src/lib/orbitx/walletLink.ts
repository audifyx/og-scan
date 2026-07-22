/** Best-effort persistence of a Solana login <-> EVM wallet link. */
import { supabase } from "@/lib/supabase";

export async function linkEvmToSolana(solanaPubkey: string, evmAddress: string): Promise<void> {
  if (!solanaPubkey || !evmAddress) return;
  try {
    await supabase.from("orbitx_wallet_links").upsert(
      { solana_pubkey: solanaPubkey, evm_address: evmAddress, updated_at: new Date().toISOString() },
      { onConflict: "solana_pubkey" },
    );
  } catch { /* table may not exist yet; localStorage still holds the link */ }
}
