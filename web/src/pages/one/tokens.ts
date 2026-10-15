export interface Token {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  color: string;
}

export const TOKENS: Token[] = [
  { symbol: "SOL",  name: "Solana",  mint: "So11111111111111111111111111111111111111112", decimals: 9, color: "#9945FF" },
  { symbol: "USDC", name: "USD Coin", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6, color: "#2775CA" },
  { symbol: "USDT", name: "Tether",   mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6, color: "#26A17B" },
  { symbol: "JUP",  name: "Jupiter",  mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6, color: "#C7F284" },
  { symbol: "BONK", name: "Bonk",     mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB4", decimals: 5, color: "#FF9A3D" },
];

export const tokenBySymbol = (s: string) => TOKENS.find((t) => t.symbol === s)!;
