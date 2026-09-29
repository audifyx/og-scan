/**
 * ORBITX tokenomics — public surface.
 *
 * The game core team and all module teams import from here.
 * The `useOrbitxBilling` shape is contract-locked — do not change it
 * without coordinating (see web/src/city/BILLING_CONTRACT.md).
 */
export { ORBITX_MINT, ORBITX_SYMBOL, ORBITX_PRICES, FEE_DISCOUNT_TIERS, feeDiscountBpsFor, formatOrbitx, spendReason } from "./constants";
export type { OrbitxPriceKey } from "./constants";

export { getBillingAuthCode, clearBillingAuth, requestBillingAuth, approveBillingLinkAuth } from "./auth";

export { callSupercomputerTool, fetchDeskWallet, burnOrbitxViaDesk } from "./mcpClient";
export type { McpToolResult, DeskWalletInfo, BurnResult } from "./mcpClient";

export { useOrbitxBilling, getSpendLedger } from "./useOrbitxBilling";
export type { SpendArgs, SpendLedgerEntry } from "./useOrbitxBilling";

export { meetsHold, useAlphaGate, useProAccess, grantProUnlock, useFeeDiscount, useSupportPriority } from "./gating";

export { createAuction, settleAuctionPure, useAuctions } from "./auction";
export type { Auction, AuctionBid } from "./auction";

export { recordApiCall, overageUnitsDue, useApiMetering, FREE_TIER_CALLS } from "./metering";

export { BurnButton, BillingBanner } from "./ui/BurnButton";
export { PinButton, TipButton } from "./ui/TipPinButtons";
export { VoteWidget } from "./ui/VoteWidget";
export { BountyBoard, CompetitionBoard } from "./ui/BountyCompetition";
export { AlphaGate, PriorityLaneNote } from "./ui/Gating";
export { ProfileTokenomicsPanel } from "./ui/BadgePanel";
export { TickerReserveButton, reservedTickerSig } from "./ui/ReserveButtons";
export { ApiMeterPanel } from "./ui/ApiMeterPanel";
export { ReferralRewardsPanel, REFERRAL_REWARD_PER_QUALIFIED } from "./ui/ReferralRewardsPanel";
export { FeeDiscountRow, FeeDiscountNote, discountedFee } from "./ui/FeeDiscountRow";
export { BuildsBoard } from "./ui/BuildsBoard";
export { AuctionPanel } from "./ui/AuctionPanel";
export { ThemeMarketplace } from "./theme-marketplace/ThemeMarketplace";
