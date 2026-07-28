/** 
 * DEX (Decentralized Exchange) Terminal system for trading crypto/tokens within the game world.
 * Integrates real-time price data and swapping mechanics.
 */

export interface TokenData {
  symbol: string;
  name: string;
  address: string;
  price: number; // USD
  change24h: number; // Percentage
  volume24h: number; // USD
  marketCap: number; // USD
  chain: 'ethereum' | 'solana' | 'arbitrum' | 'base';
  icon?: string;
}

export interface DEXTrade {
  id: string;
  timestamp: number;
  tokenIn: TokenData;
  tokenOut: TokenData;
  amountIn: number;
  amountOut: number;
  priceImpact: number; // Percentage
  slippage: number; // User set percentage
  fee: number; // USD
  status: 'pending' | 'completed' | 'failed';
}

export interface TradeHistory {
  userId: string;
  trades: DEXTrade[];
  totalVolume: number; // USD
  totalFees: number; // USD
  totalGains: number; // USD (P&L)
}

/**
 * DEX Terminal - in-world terminal for trading.
 */
export class DEXTerminal {
  id: string;
  position: { x: number; y: number; z: number };
  tokens: Map<string, TokenData> = new Map();
  tradeHistory: Map<string, TradeHistory> = new Map();
  private priceUpdateInterval: number = 30000; // 30 seconds
  private lastPriceUpdate: number = 0;

  constructor(id: string, position: { x: number; y: number; z: number }) {
    this.id = id;
    this.position = position;
  }

  /**
   * Get current token listings.
   */
  getTokenListings(): TokenData[] {
    return Array.from(this.tokens.values());
  }

  /**
   * Add token to terminal.
   */
  addToken(token: TokenData) {
    this.tokens.set(token.symbol, token);
  }

  /**
   * Update token price data.
   */
  updateTokenPrice(symbol: string, price: number, change24h: number, volume24h: number) {
    const token = this.tokens.get(symbol);
    if (token) {
      token.price = price;
      token.change24h = change24h;
      token.volume24h = volume24h;
      this.lastPriceUpdate = Date.now();
    }
  }

  /**
   * Simulate a trade.
   */
  executeTrade(
    userId: string,
    tokenIn: string,
    tokenOut: string,
    amountIn: number,
    slippage: number = 0.5
  ): DEXTrade | null {
    const inToken = this.tokens.get(tokenIn);
    const outToken = this.tokens.get(tokenOut);

    if (!inToken || !outToken) {
      console.error('[v0] Token not found on DEX terminal');
      return null;
    }

    // Calculate output amount
    const inUSD = amountIn * inToken.price;
    const priceImpact = amountIn * 0.001; // Simplified - 0.1% impact per unit
    const slippageAmount = inUSD * (slippage / 100);
    const actualOut = (inUSD - slippageAmount) / outToken.price;

    // Calculate fee (0.25% of input)
    const fee = inUSD * 0.0025;

    const trade: DEXTrade = {
      id: `trade-${Date.now()}`,
      timestamp: Date.now(),
      tokenIn: inToken,
      tokenOut: outToken,
      amountIn,
      amountOut: actualOut,
      priceImpact,
      slippage,
      fee,
      status: 'completed',
    };

    // Record in history
    if (!this.tradeHistory.has(userId)) {
      this.tradeHistory.set(userId, {
        userId,
        trades: [],
        totalVolume: 0,
        totalFees: 0,
        totalGains: 0,
      });
    }

    const history = this.tradeHistory.get(userId)!;
    history.trades.push(trade);
    history.totalVolume += inUSD;
    history.totalFees += fee;

    console.log(`[v0] Trade executed: ${amountIn} ${tokenIn} -> ${actualOut.toFixed(4)} ${tokenOut}`);
    return trade;
  }

  /**
   * Get user's trade history.
   */
  getTradeHistory(userId: string): TradeHistory | undefined {
    return this.tradeHistory.get(userId);
  }

  /**
   * Get leaderboard of top traders by volume.
   */
  getTopTraders(limit: number = 10): Array<{ userId: string; volume: number; gains: number }> {
    return Array.from(this.tradeHistory.values())
      .map((h) => ({ userId: h.userId, volume: h.totalVolume, gains: h.totalGains }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, limit);
  }

  /**
   * Calculate optimal route for swap (simplified).
   */
  getSwapRoute(tokenIn: string, tokenOut: string, amount: number): {
    expectedOutput: number;
    priceImpact: number;
    path: string[];
  } {
    const inToken = this.tokens.get(tokenIn);
    const outToken = this.tokens.get(tokenOut);

    if (!inToken || !outToken) {
      return { expectedOutput: 0, priceImpact: 0, path: [] };
    }

    const inUSD = amount * inToken.price;
    const expectedOutput = inUSD / outToken.price;
    const priceImpact = amount * 0.001; // Simplified

    return {
      expectedOutput,
      priceImpact,
      path: [tokenIn, tokenOut],
    };
  }
}

/**
 * DEX Terminal Manager - manages multiple terminals in world.
 */
export class DEXTerminalManager {
  private terminals: Map<string, DEXTerminal> = new Map();

  addTerminal(terminal: DEXTerminal) {
    this.terminals.set(terminal.id, terminal);
  }

  getTerminal(id: string): DEXTerminal | undefined {
    return this.terminals.get(id);
  }

  getAllTerminals(): DEXTerminal[] {
    return Array.from(this.terminals.values());
  }

  /**
   * Get nearest terminal to position.
   */
  getNearestTerminal(pos: { x: number; y: number; z: number }, maxDistance: number = 100): DEXTerminal | undefined {
    let nearest: DEXTerminal | undefined;
    let minDistance = maxDistance;

    this.terminals.forEach((terminal) => {
      const dist = Math.hypot(
        terminal.position.x - pos.x,
        terminal.position.z - pos.z
      );

      if (dist < minDistance) {
        minDistance = dist;
        nearest = terminal;
      }
    });

    return nearest;
  }

  dispose() {
    this.terminals.clear();
  }
}

/**
 * Default DEX tokens available in OrbitX City.
 */
export const DEFAULT_DEX_TOKENS: TokenData[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    address: '0x0000000000000000000000000000000000000000',
    price: 2450,
    change24h: 2.5,
    volume24h: 18_000_000_000,
    marketCap: 294_000_000_000,
    chain: 'ethereum',
  },

  {
    symbol: 'SOL',
    name: 'Solana',
    address: 'So11111111111111111111111111111111111111112',
    price: 142,
    change24h: 5.2,
    volume24h: 2_500_000_000,
    marketCap: 59_000_000_000,
    chain: 'solana',
  },

  {
    symbol: 'ARB',
    name: 'Arbitrum',
    address: '0x912ce59144191c1204e64559fe8253a0e49e6920',
    price: 0.95,
    change24h: -1.2,
    volume24h: 350_000_000,
    marketCap: 3_200_000_000,
    chain: 'arbitrum',
  },

  {
    symbol: 'BASE',
    name: 'Base',
    address: '0x4621b7bbeee6b937df07467bccc27ad9ffdc8721',
    price: 0.55,
    change24h: 8.1,
    volume24h: 180_000_000,
    marketCap: 2_100_000_000,
    chain: 'base',
  },

  {
    symbol: 'ORBX',
    name: 'OrbitX Token',
    address: '0xorbx0000000000000000000000000000000000000',
    price: 12.5,
    change24h: 15.3,
    volume24h: 45_000_000,
    marketCap: 625_000_000,
    chain: 'base',
    icon: 'orbx-icon',
  },
];
