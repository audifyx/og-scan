---
name: orbitx-web3
description: Use when working on wallets, sign-in, token launches, swaps, vanity addresses, bonding curves, or smart contracts in this repo. Covers Solana SIWS login via wallet-auth, the hand-rolled EVM wallet layer (no wagmi), pump.fun launches with vanity 'obx' mints, Jupiter swap flow, CREATE2 vanity grinding, and the OrbitXCurve contracts. Trigger for any "wallet", "launch a token", "swap", "connect", "deploy ERC-20", "bonding curve" task.
---

# OrbitX Web3 & Launchpad

Solana is the primary identity chain; EVM is a linked secondary. The EVM layer is deliberately dependency-free — do not introduce wagmi/viem/ethers at runtime.

## Solana wallet login (SIWS)

- Stack: `@solana/wallet-adapter-react` with explicit Phantom/Solflare/Torus/Ledger adapters; Jupiter/Backpack/etc. appear via Wallet Standard discovery (`useWallet().wallets`).
- UI: `WalletConnectButton.tsx` → `WalletPickerModal.tsx` (rendered via **portal** so it centers regardless of parent stacking context) → `useWalletSignIn.tsx`.
- **Critical ordering**: `select(adapter.name)` → `await adapter.connect()` → *then* check `adapter.signMessage` — Wallet Standard adapters only expose `signMessage` after connect. This was a production bug (commit `ee3d2af`); keep the order.
- Auth flow (`web/src/lib/walletAuth.ts` + `supabase/functions/wallet-auth`): POST `{action:"nonce", pubkey}` → sign returned message → POST `{action:"verify", pubkey, signature(bs58)}` → `supabase.auth.setSession({access_token, refresh_token})`. `isNew: true` triggers the merge UI (`MergeAccountModal`) for legacy email accounts.
- `WalletAuthBridge.tsx` auto-runs SIWS whenever any route connects a wallet without a Supabase session (per-pubkey sessionStorage guard). Never invent a separate session store — Supabase auth *is* the session.
- EVM linking: when a Solana pubkey and an EVM account are both present, `linkEvmToSolana` upserts `orbitx_wallet_links` (see `LaunchpadLayout.tsx` + `web/src/lib/walletLink.ts`). EVM never replaces SIWS as login.

## EVM wallet layer (hand-rolled)

`web/src/lib/evm/wallet.ts` implements EIP-1193 + EIP-6963 directly:
- `discoverWallets()` (EIP-6963 announce + `window.ethereum` fallback), `connectWallet`, `ensureChain` (wallet_switchEthereumChain + add), `sendDeployTransaction`, `waitForReceipt`.
- WalletConnect v2 loads dynamically from esm.sh only if `VITE_WALLETCONNECT_PROJECT_ID` is set. Mobile deep links for MetaMask/Coinbase/Trust.
- Global state: `web/src/hooks/useEvmWallet.tsx` (auto-reconnect via `eth_accounts`, localStorage persistence, portal connect modal).
- Crypto primitives are hand-rolled and fuzz-verified against ethers offline: keccak in `web/src/lib/evm/keccak.ts`, ABI/bytecode in `web/src/lib/evm/erc20.ts`. If you change them, re-verify against ethers.
- Chain registry for launches: `web/src/lib/orbitx/chains.ts` — Solana + 12 EVM chains (Base, ETH, BNB, Arbitrum, OP, Polygon, Avalanche, Blast, Sonic, HyperEVM, Monad beta, Robinhood). The "16 chains" in the README refers to *intel/screener coverage*, not deploy targets.

## Pump.fun launch flow

Canonical helper: `web/src/lib/orbitx/pumpLaunch.ts`; UI lane `pages/orbitx/LaunchpadPump.tsx`; server `web/api/pump-create.ts`.

1. `POST /api/pump-create {step:"ipfs"}` — Pinata upload (image + metadata with `createdOn: "https://orbitx.world"`, `platformId: "orbitx"`) → `metadataUri`. Env: `PINATA_JWT`.
2. `POST /api/vanity-mint {suffix:"obx"}` — server grinds ed25519 keypairs (`@noble/curves`, **not** web3.js — it ESM-crashes there) until the base58 address ends in the suffix. 60s `maxDuration`, 55s budget → 504; client falls back to a random keypair.
3. `POST /api/pump-create {step:"create"}` — PumpPortal `/api/trade-local` returns a base64 **unsigned** tx.
4. Client: deserialize → `tx.sign([mintKeypair])` → wallet `signTransaction` → `connection.sendRawTransaction`.

**The production vanity suffix is `obx`.** `VANITY_MINT_IMPLEMENTATION.md` ("orbit") and `VANITY_MINT_VERIFICATION.md` ("bit") are stale history — ignore them.

## CREATE2 vanity for EVM (keyless deploys)

`web/src/lib/evm/create2.ts` — `grindVanitySalt(initCodeHex, suffix)` iterates salts computing `keccak(0xff ++ ArachnidProxy ++ salt ++ keccak(initCode))` in 256-iteration batches with `onProgress`/`shouldStop` and a `setTimeout(0)` yield so the UI stays responsive. Deploy: `tx.to = CREATE2_PROXY (0x4e59b4...)`, `data = salt || initCode`, user-signed; falls back to a plain create tx if the proxy isn't deployed on that chain. See `LaunchpadApiLaunch.tsx`.

## Jupiter swaps

- Client helpers in `web/src/lib/og.ts`: base `https://lite-api.jup.ag`, `jupQuote` → `/swap/v1/quote`, `jupSwapTransaction` → `/swap/v1/swap` (base64 tx).
- Full in-app execute flow (see `BuySellPanel` in `pages/orbitx/LaunchpadToken.tsx`): quote → `jupSwapTransaction(quote, pubkey)` → `VersionedTransaction.deserialize` → wallet `signTransaction` → `sendRawTransaction({skipPreflight:false, maxRetries:3})` → `confirmTransaction(sig, "confirmed")`.
- `SwapPanel.tsx` is quote-only + Phantom deep-link — it does NOT execute in-app. Don't assume it does.
- Edge functions `jupiter-quote`/`jupiter-swap` exist as a server path (keyed `api.jup.ag`) but the primary in-app execute doesn't use them.

## RPC proxying

Browser code must never carry Helius/Alchemy keys. Use `POST /api/ogdex/rpc` (→ `callFn("rpc-proxy", {provider:"helius", method, params})`) or the `rpc-proxy` / `solana-rpc-proxy` edge functions. The ogdex client builds `new Connection(origin + "/api/ogdex/rpc")` and confirms via HTTP polling (no websockets).

## Contracts

| File | Status | Notes |
|---|---|---|
| `contracts/evm/OrbitXToken.sol` | **Production** Direct Deploy | Minimal fixed-supply ERC-20, no owner/mint; bytecode embedded in `web/src/lib/evm/erc20.ts` |
| `contracts/OrbitXToken.sol` (root) | Legacy | Owner+mint variant, not the deployed bytecode |
| `contracts/evm/OrbitXCurve.sol` | Production | Ownerless pump-style factory + per-token curve. Constant product `dy = y*netIn/(x+netIn)` over virtual+real native reserves; `feeBps` (≤10%) split creator/platform; graduation at `realNative >= graduationNative`; `pullLiquidity` only by immutable migrator. Frontend defaults in `web/src/lib/evm/curve.ts`: 1% fee, 0.5% creator, 1B supply / 800M on curve |
| `contracts/evm/OrbitXCurveMigrator.sol` | Production | Permissionless post-graduation `migrate()` → Uniswap-v2 `addLiquidityETH`, LP burned to `0x…dEaD` |
| `contracts/nft_coin/programs/nft_coin/src/lib.rs` | **Reference only, NOT deployed** | Live NFT collection coins launch on pump.fun via `pumpLaunch.ts` (`coin_mint` on `orbitx_nft_collections`) |

USDC settlement exists only in the NFT marketplace (`supabase/functions/nft-execute-sale`: SPL transfers, 6 decimals, buyer → seller/royalty/1% platform ATAs, marketplace-authority partial-sign). Token launch fees are SOL/promo, not USDC.
