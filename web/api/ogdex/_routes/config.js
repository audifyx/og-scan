import { send, PAY_WALLET, cache } from "../_lib.js";
export default async function handler(req, res) {
  cache(res, 300, 600);
  return send(res, 200, {
    payWallet: PAY_WALLET,
    pricing: [
      { tier: "standard", price: 40, sla: "24 hours", label: "Standard listing" },
      { tier: "express", price: 60, sla: "6 hours", label: "Express listing" },
    ],
    chains: ["solana", "ethereum", "base", "bsc", "polygon", "arbitrum", "avalanche", "ton", "sui", "tron", "other"],
    telegram: "@ogscanofficial",
    community: { x: "200+", ogscan: "55+", telegram: "yes" },
  });
}
