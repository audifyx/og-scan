// OrbitX NFT Hub — uploads NFT media + standard metadata JSON to Supabase
// Storage (same public "profile-media" bucket the token launch lanes already
// use), producing a public HTTPS metadata URI suitable for on-chain `uri`.
import { supabase } from "@/lib/supabase";
import type { NftAttribute } from "@/lib/orbitx/nftMint";

export interface NftMetaInput {
  name: string;
  symbol: string;
  description: string;
  externalUrl?: string;
  attributes: NftAttribute[];
  creatorWallet: string;
  royaltyBps: number;
  collectionName?: string;
}

const ACCEPTED_MIME_PREFIXES = ["image/", "video/", "audio/"];

export function isAcceptedNftMedia(file: File): boolean {
  return ACCEPTED_MIME_PREFIXES.some((p) => file.type.startsWith(p));
}

export async function uploadNftAssets(seed: string, mediaFile: File, meta: NftMetaInput): Promise<{ mediaUrl: string; uri: string }> {
  const mime = mediaFile.type || "image/png";
  const ext = (mime.split("/")[1] || "png").replace("jpeg", "jpg");
  const mediaPath = `orbitxnft/${seed}/media.${ext}`;
  const { error: mediaErr } = await supabase.storage.from("profile-media").upload(mediaPath, mediaFile, { contentType: mime, upsert: true });
  if (mediaErr) throw new Error(`Media upload failed: ${mediaErr.message}`);
  const mediaUrl = supabase.storage.from("profile-media").getPublicUrl(mediaPath).data.publicUrl;

  const isImage = mime.startsWith("image/");
  const metaJson = {
    name: meta.name,
    symbol: meta.symbol,
    description: meta.description,
    image: isImage ? mediaUrl : undefined,
    animation_url: !isImage ? mediaUrl : undefined,
    external_url: meta.externalUrl || undefined,
    attributes: meta.attributes.filter((a) => a.trait_type.trim() && a.value.trim()),
    seller_fee_basis_points: meta.royaltyBps,
    properties: {
      files: [{ uri: mediaUrl, type: mime }],
      category: mime.split("/")[0],
      creators: [{ address: meta.creatorWallet, share: 100 }],
    },
    collection: meta.collectionName ? { name: meta.collectionName, family: "OrbitX" } : undefined,
    tags: ["orbitx-nft"],
  };
  const jsonPath = `orbitxnft/${seed}/metadata.json`;
  const { error: jsonErr } = await supabase.storage.from("profile-media")
    .upload(jsonPath, new Blob([JSON.stringify(metaJson, null, 2)], { type: "application/json" }), { contentType: "application/json", upsert: true });
  if (jsonErr) throw new Error(`Metadata upload failed: ${jsonErr.message}`);
  const uri = supabase.storage.from("profile-media").getPublicUrl(jsonPath).data.publicUrl;

  return { mediaUrl, uri };
}
