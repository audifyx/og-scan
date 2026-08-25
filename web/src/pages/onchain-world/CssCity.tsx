import { useMemo } from "react";
import type { CityDistricts, KolCard, TokenDistrict } from "./api";

type Props = {
  kols: KolCard[];
  districts?: CityDistricts | null;
  followWallet?: string | null;
  onWallet: (address: string) => void;
  onToken: (mint: string) => void;
};

const SEED: { mint: string; symbol: string }[] = [
  { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", symbol: "JUP" },
  { mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", symbol: "RAY" },
  { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK" },
  { mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", symbol: "WIF" },
  { mint: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv", symbol: "PENGU" },
  { mint: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN", symbol: "TRUMP" },
];

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function fillBlocks() {
  const out: { x: number; z: number; h: number; tone: string }[] = [];
  for (let gx = -11; gx <= 11; gx++) {
    for (let gz = -11; gz <= 11; gz++) {
      const x = gx * 18;
      const z = gz * 18;
      const r = Math.hypot(x, z);
      if (r < 54 || r > 188) continue;
      const n = Math.abs(gx * 13 + gz * 29);
      out.push({
        x,
        z,
        h: 18 + (n % 9) * 8,
        tone: n % 5 === 0 ? "#22d3ee" : n % 3 === 0 ? "#c084fc" : "#7c3aed",
      });
    }
  }
  return out.slice(0, 160);
}

export default function CssCity({ kols, districts, followWallet, onWallet, onToken }: Props) {
  const blocks = useMemo(fillBlocks, []);
  const tokens = useMemo(() => {
    const live = districts?.tokens || [];
    const byMint = new Map<string, TokenDistrict>();
    for (const s of SEED) byMint.set(s.mint, { mint: s.mint, symbol: s.symbol, kind: "token" });
    for (const t of live) if (t?.mint) byMint.set(t.mint, t);
    return [...byMint.values()].slice(0, 16);
  }, [districts?.tokens]);

  return (
    <div className="oxw-css" aria-label="OrbitX software city">
      <div className="oxw-css-scene">
        <div className="oxw-css-ground" />
        <div className="oxw-css-ring" style={{ width: 120, height: 120, margin: -60 }} />
        <div className="oxw-css-ring cyan" style={{ width: 220, height: 220, margin: -110 }} />
        <div className="oxw-css-ring amber" style={{ width: 320, height: 320, margin: -160 }} />
        {blocks.map((b, i) => (
          <div
            key={i}
            className="oxw-css-bldg"
            style={{
              width: 12,
              height: b.h,
              left: b.x,
              top: b.z,
              background: `linear-gradient(${b.tone}44, #0b0816)`,
              boxShadow: `0 0 10px ${b.tone}55`,
            }}
          />
        ))}
        <button type="button" className="oxw-css-tower" onClick={() => onToken("13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9")}>
          <i />
          <span>ORBITX</span>
        </button>
        <div className="oxw-css-hub jup" style={{ left: 110, top: 36 }}><b>JUPITER DEX</b></div>
        <div className="oxw-css-hub ray" style={{ left: -120, top: 70 }}><b>RAYDIUM DEX</b></div>
        <div className="oxw-css-hub pump" style={{ left: 70, top: -130 }}><b>PUMP.FUN</b></div>
        {tokens.map((t, i) => {
          const a = (i / Math.max(tokens.length, 1)) * Math.PI * 2 + 0.4;
          const r = 96;
          return (
            <button
              key={t.mint}
              type="button"
              className="oxw-css-token"
              style={{ left: Math.cos(a) * r, top: Math.sin(a) * r, height: 36 + (hash(t.mint) % 28) }}
              onClick={() => onToken(t.mint)}
            >
              <em>${t.symbol}</em>
            </button>
          );
        })}
        {kols.slice(0, 24).map((k, i) => {
          const a = (i / Math.max(kols.length, 1)) * Math.PI * 2 - Math.PI / 2;
          const r = 62;
          const on = followWallet === k.address;
          return (
            <button
              key={k.address}
              type="button"
              className={`oxw-css-agent${on ? " on" : ""}`}
              style={{ left: Math.cos(a) * r, top: Math.sin(a) * r }}
              onClick={() => onWallet(k.address)}
            >
              <i />
              <span>{k.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
