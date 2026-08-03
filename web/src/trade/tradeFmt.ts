export function fmtUsd(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (a >= 1) return `$${n.toFixed(2)}`;
  if (a >= 0.01) return `$${n.toFixed(4)}`;
  if (a > 0) return `$${n.toExponential(2)}`;
  return "$0";
}

export function fmtPct(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function shortAddr(a: string, n = 4): string {
  if (!a || a.length < 10) return a || "—";
  return `${a.slice(0, n)}…${a.slice(-n)}`;
}

export function dexChartUrl(ref: string, interval = "15"): string {
  const q = new URLSearchParams({
    embed: "1",
    loadChartSettings: "0",
    trades: "0",
    tabs: "0",
    info: "0",
    chartLeftToolbar: "0",
    chartDefaultOnMobile: "1",
    chartTheme: "dark",
    theme: "dark",
    chartStyle: "1",
    chartType: "usd",
    interval,
  });
  return `https://dexscreener.com/solana/${ref}?${q.toString()}`;
}
