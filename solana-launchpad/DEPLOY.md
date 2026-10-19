# OrbitX Launchpad — Deployment Guide

## Programs

| Program | Address | File |
|---------|---------|------|
| orbitx-launchpad | `HjmM9TuHd1h4QFBrtYbZWsDCRysSMXYBDXXEmMKWZfh7` | `deploy/orbitx_launchpad.so` |
| transfer-hook | `9WobRvPGR37kHaSiMyiss1LCDXvBHBAfJ3VpSJcfZTtW` | `deploy/orbitx_transfer_hook.so` |

## Deploy to Devnet (testing)

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Configure for devnet
solana config set --url devnet

# Create deployer wallet (or use existing)
solana-keygen new -o deployer.json

# Fund with devnet SOL
solana airdrop 2 --keypair deployer.json

# Deploy both programs
solana program deploy deploy/orbitx_launchpad.so \
  --keypair deployer.json \
  --program-id deploy/orbitx_launchpad-keypair.json \
  --url devnet

solana program deploy deploy/orbitx_transfer_hook.so \
  --keypair deployer.json \
  --program-id deploy/orbitx_transfer_hook-keypair.json \
  --url devnet
```

## Deploy to Mainnet (production)

```bash
solana config set --url mainnet-beta

# Fund deployer with ~3 SOL for both deployments
solana program deploy deploy/orbitx_launchpad.so \
  --keypair deployer.json \
  --program-id deploy/orbitx_launchpad-keypair.json \
  --url mainnet-beta

solana program deploy deploy/orbitx_transfer_hook.so \
  --keypair deployer.json \
  --program-id deploy/orbitx_transfer_hook-keypair.json \
  --url mainnet-beta
```

## Initialize

After deploying, call `initialize` on the launchpad program to create the global registry:

```bash
# Using Anchor or a client script
# seeds: ["registry"]
# Creates the Registry PDA that tracks all launched tokens
```

## Program Features

### orbitx-launchpad
- `initialize` — Create global registry
- `launch_token(name, symbol, uri, decimals, supply, max_tx_bps, sniper_tax_bps, sniper_window_slots)` — Launch a token
  - Enforces unique name/symbol via PDA (duplicate = transaction fails)
  - Creates TokenConfig PDA with trade parameters
- `update_protections(max_tx_bps, sniper_tax_bps)` — Update (creator only)

### transfer-hook (Token-2022)
- Automatically called on every transfer
- Rejects transfers exceeding `max_tx_bps` of total supply
- Logs sniper tax for transfers within `sniper_window_slots` of launch

## Integration with MCP

The `launchpad_launch` MCP tool will:
1. Check name/symbol uniqueness (off-chain, fast)
2. Build and send the `launch_token` instruction via the desk wallet
3. Create the Token-2022 mint with transfer hook extension
4. Initialize Raydium pool with $4k initial liquidity
5. Record in `launchpad_tokens` table
