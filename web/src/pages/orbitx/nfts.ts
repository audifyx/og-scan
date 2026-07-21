// OrbitX — real on-chain NFT holdings via Helius DAS (getAssetsByOwner).
// Shared by the Portfolio "NFTs" tab and the NFT Hub "My NFTs" view so both
// read the exact same live wallet data — no mock/fabricated NFTs anywhere.
import { useQuery } from "@tanstack/react-query";
import { HELIUS_RPC } from "@/lib/og";

export interface OwnedNft {
  id: string;
  name: string;
  symbol: string;
  image: string | null;
  collection: string | null;
  interface: string;
  compressed: boolean;
}

async function fetchNftsByOwner(owner: string): Promise<OwnedNft[]> {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "orbitx-nfts",
      method: "getAssetsByOwner",
      params: {
        ownerAddress: owner,
        page: 1,
        limit: 1000,
        displayOptions: { showFungible: false, showZeroBalance: false },
      },
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error?.message || "DAS request failed");
  const items: any[] = json?.result?.items ?? [];
  return items
    .filter((a) => a.interface === "V1_NFT" || a.interface === "ProgrammableNFT" || a.interface === "V2_NFT" || a.interface === "MplCoreAsset")
    .map((a) => {
      const grouping = Array.isArray(a.grouping) ? a.grouping.find((g: any) => g.group_key === "collection") : null;
      return {
        id: a.id,
        name: a.content?.metadata?.name || a.content?.metadata?.symbol || "Unnamed NFT",
        symbol: a.content?.metadata?.symbol || "",
        image: a.content?.links?.image || a.content?.files?.[0]?.uri || null,
        collection: grouping?.group_value ?? null,
        interface: a.interface,
        compressed: !!a.compression?.compressed,
      } as OwnedNft;
    });
}

export function useWalletNfts(owner: string | undefined) {
  return useQuery({
    queryKey: ["orbitx-wallet-nfts", owner],
    enabled: !!owner,
    staleTime: 30_000,
    queryFn: () => fetchNftsByOwner(owner!),
  });
}
