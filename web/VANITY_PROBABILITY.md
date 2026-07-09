# Vanity Address Probability Analysis

## Problem
Searching for addresses ending in "orbit" (5 characters) is extremely computationally expensive.

### Base58 Character Set
Solana uses 58 possible characters in base58 encoding (0-9, A-Z except I,O,l,o, a-z except l).

### Probability Math
- For a 1-character suffix: 1 in 58 addresses match
- For a 2-character suffix: 1 in 58² = 3,364 addresses match
- For a 3-character suffix: 1 in 58³ = 195,112 addresses match
- For a 4-character suffix: 1 in 58⁴ = 11,316,496 addresses match
- **For a 5-character suffix ("orbit"): 1 in 58⁵ = ~656 million addresses match**

### Expected Attempts
With 500,000 iterations: **Less than 0.08% chance** of finding "orbit"

## Solution: Use Shorter Suffix

Recommended options:
1. **"bit" (3 chars)** - ~195K attempts average (0.2-1 second)
2. **"orb" (3 chars)** - ~195K attempts average (0.2-1 second)
3. **"rbit" (4 chars)** - ~11M attempts average (20-60 seconds)
4. **"orbit" (5 chars)** - ~656M attempts average (unrealistic for real-time)

## What We'll Do

Change to **"bit"** suffix instead of "orbit":
- Still indicates Pump/BitCoin/Crypto theme
- Realistically findable in <2 seconds
- Works within Vercel serverless timeout limits

Alternative: Use **"orb"** (3 letters from "orbit") for slight variation.
