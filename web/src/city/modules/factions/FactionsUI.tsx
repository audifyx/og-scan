/**
 * ORBITXCITY — Factions module: UI.
 *
 * Mount point: <FactionsRoot /> — a tabbed panel (Firms / Turf / Walls / Mayor).
 * Integrator should mount it as a phone-menu tab or pause-menu screen.
 * Everything is inline-styled and mobile-first; no external CSS, no other
 * module imports.
 *
 * Suggested wiring:
 *   import { FactionsRoot } from "@/city/modules/factions";
 *   // inside the phone UI or a modal:
 *   <FactionsRoot onClose={...} />
 */
import React, { useState } from "react";
import type { District, FactionId, GraffitiWar } from "./types";
import { FACTIONS, FACTION_IDS, repToNextRank } from "./factions";
import { activeWars, FEE_SHARE_PCT } from "./turf";
import { TAG_COST, OVERPAINT_COST, judgeWar } from "./graffiti";
import { VOTE_COST_ORBITX, msUntilTermEnd } from "./elections";
import { useFactions, playerLabel } from "./useFactions";

/* -------------------------------- styles -------------------------------- */

const S: Record<string, React.CSSProperties> = {
  root: {
    width: "100%", maxWidth: 460, margin: "0 auto", color: "#e5e7eb",
    fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 14,
    background: "#0b0f1a", borderRadius: 12, overflow: "hidden",
  },
  header: {
    display: "flex", gap: 4, padding: 8, background: "#111827",
    position: "sticky", top: 0, zIndex: 2,
  },
  tab: {
    flex: 1, padding: "10px 4px", border: "none", borderRadius: 8,
    background: "transparent", color: "#9ca3af", fontSize: 12, fontWeight: 700,
    cursor: "pointer",
  },
  tabOn: { background: "#1f2937", color: "#fff" },
  body: { padding: 12, maxHeight: "70vh", overflowY: "auto" },
  card: {
    background: "#111827", border: "1px solid #1f2937", borderRadius: 10,
    padding: 12, marginBottom: 10,
  },
  title: { fontSize: 15, fontWeight: 800, margin: "0 0 4px" },
  sub: { color: "#9ca3af", fontSize: 12, margin: "0 0 8px" },
  btn: {
    background: "#22d3ee", color: "#06121a", border: "none", borderRadius: 8,
    padding: "9px 12px", fontWeight: 800, fontSize: 13, cursor: "pointer",
    width: "100%", marginTop: 6,
  },
  btnGhost: {
    background: "#1f2937", color: "#e5e7eb", border: "1px solid #374151",
    borderRadius: 8, padding: "8px 10px", fontWeight: 700, fontSize: 12,
    cursor: "pointer", width: "100%", marginTop: 6,
  },
  row: { display: "flex", alignItems: "center", gap: 8 },
  chip: {
    display: "inline-block", padding: "2px 8px", borderRadius: 999,
    fontSize: 11, fontWeight: 800,
  },
  input: {
    width: "100%", boxSizing: "border-box", background: "#0b0f1a",
    border: "1px solid #374151", borderRadius: 8, color: "#fff",
    padding: "9px 10px", fontSize: 13, marginTop: 6,
  },
  feed: { fontSize: 12, color: "#9ca3af", lineHeight: 1.5 },
  bar: { height: 6, borderRadius: 4, background: "#1f2937", overflow: "hidden", marginTop: 4 },
};

function FirmChip({ id }: { id: FactionId | null }) {
  if (!id) return <span style={{ ...S.chip, background: "#1f2937", color: "#9ca3af" }}>UNAFFILIATED</span>;
  const f = FACTIONS[id];
  return <span style={{ ...S.chip, background: f.color, color: "#06121a" }}>{f.short}</span>;
}

function Logo({ id, size = 28 }: { id: FactionId; size?: number }) {
  const f = FACTIONS[id];
  return (
    <span style={{ color: f.color, display: "inline-flex", width: size, height: size }}>
      <svg viewBox="0 0 64 64" width={size} height={size} dangerouslySetInnerHTML={{ __html: f.logoSvg }} />
    </span>
  );
}

/* -------------------------------- firms --------------------------------- */

function FirmPanel() {
  const [state, store] = useFactions();
  const p = state.player;
  const my = p.factionId ? FACTIONS[p.factionId] : null;
  const { next, needed } = repToNextRank(p.rep);
  const buff = store.playerWallBuff();
  return (
    <div>
      <div style={S.card}>
        <p style={S.title}>Your colors</p>
        {my ? (
          <div>
            <div style={S.row}>
              <Logo id={my.id} size={36} />
              <div>
                <div style={{ fontWeight: 800 }}>{my.name} <FirmChip id={my.id} /></div>
                <div style={S.sub}>{my.motto}</div>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 12 }}>
              Rank: <b>{p.rank}</b> · Rep: <b>{p.rep}</b>
              {next && <span style={{ color: "#9ca3af" }}> · {needed} rep to {next}</span>}
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
              Firm buff: {my.buff.label}
              {buff > 0 && <span> · Wall buff: +{(buff * 100).toFixed(0)}% earnings</span>}
            </div>
            <button style={S.btnGhost} onClick={() => store.leave()}>Walk away</button>
          </div>
        ) : (
          <p style={S.sub}>Unaffiliated. Pick a firm — the streets notice.</p>
        )}
      </div>
      {FACTION_IDS.filter((id) => id !== p.factionId).map((id) => {
        const f = FACTIONS[id];
        return (
          <div key={id} style={S.card}>
            <div style={S.row}>
              <Logo id={id} size={32} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>{f.name}</div>
                <div style={S.sub}>{f.motto}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{f.buff.label}</div>
              </div>
            </div>
            <button style={{ ...S.btn, background: f.color }} onClick={() => store.join(id)}>
              Run with {f.short}
            </button>
          </div>
        );
      })}
      <div style={S.card}>
        <p style={S.title}>Firm war chest</p>
        <p style={S.sub}>Feed the firm paper CITY — 10 CITY buys 1 rep. Lifetime given: {p.lifetimeContributed} CITY.</p>
        <ContributeBox />
      </div>
      <div style={S.card}>
        <p style={S.title}>Street wire</p>
        <div style={S.feed}>
          {state.feed.slice(0, 12).map((e, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <span style={{ color: "#6b7280" }}>{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>{" "}
              {e.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContributeBox() {
  const [, store] = useFactions();
  const [amt, setAmt] = useState("100");
  return (
    <div style={S.row}>
      <input
        style={{ ...S.input, marginTop: 0, flex: 1 }}
        value={amt}
        inputMode="numeric"
        onChange={(e) => setAmt(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder="CITY"
      />
      <button
        style={{ ...S.btn, width: "auto", marginTop: 0 }}
        onClick={() => store.contribute(parseInt(amt || "0", 10))}
      >
        Donate
      </button>
    </div>
  );
}

/* --------------------------------- turf --------------------------------- */

function TurfGrid({ districts }: { districts: District[] }) {
  // 5x5 grid; cell color = controller color (dim = contested/blank)
  const cellOf = (bi: number, bj: number) =>
    districts.find((d) => d.blocks.some((b) => b.bi === bi && b.bj === bj));
  const cells: React.ReactNode[] = [];
  for (let bj = 0; bj < 5; bj++)
    for (let bi = 0; bi < 5; bi++) {
      const d = cellOf(bi, bj);
      const c = d?.controller ? FACTIONS[d.controller].color : "#1f2937";
      cells.push(
        <div
          key={`${bi}-${bj}`}
          title={d ? `${d.name} — ${d.controller ? FACTIONS[d.controller].name : "unclaimed"}` : ""}
          style={{ background: c, opacity: d?.controller ? 0.85 : 0.5, borderRadius: 3, aspectRatio: "1" }}
        />
      );
    }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 3, marginBottom: 10 }}>
      {cells}
    </div>
  );
}

function TurfPanel() {
  const [state, store] = useFactions();
  const [sel, setSel] = useState<string>(state.districts[0]?.id ?? "");
  const [stake, setStake] = useState("200");
  const district = state.districts.find((d) => d.id === sel) ?? state.districts[0];
  const wars = activeWars(state.wars);
  const myId = state.player.factionId;
  return (
    <div>
      <div style={S.card}>
        <p style={S.title}>Turf map</p>
        <TurfGrid districts={state.districts} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {state.districts.map((d) => (
            <button
              key={d.id}
              onClick={() => setSel(d.id)}
              style={{
                ...S.chip, cursor: "pointer", border: "none",
                background: d.id === sel ? "#374151" : "#1f2937",
                color: d.controller ? FACTIONS[d.controller].color : "#9ca3af",
              }}
            >
              {d.name}
            </button>
          ))}
        </div>
      </div>
      {district && (
        <div style={S.card}>
          <p style={S.title}>{district.name} <FirmChip id={district.controller} /></p>
          <p style={S.sub}>{district.blurb}</p>
          <div style={{ fontSize: 12, marginBottom: 6 }}>
            Yield {district.yieldPerHour}/h · Controller skim {(FEE_SHARE_PCT * 100 * state.office.feeShareMultiplier).toFixed(0)}% ·
            Fee pot {Math.floor(district.feePot)} CITY
          </div>
          {FACTION_IDS.map((id) => (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 2 }}>
              <span style={{ width: 64, color: FACTIONS[id].color, fontWeight: 700 }}>{FACTIONS[id].short}</span>
              <div style={{ ...S.bar, flex: 1, marginTop: 0 }}>
                <div style={{ width: `${district.influence[id]}%`, height: "100%", background: FACTIONS[id].color }} />
              </div>
              <span style={{ width: 30, textAlign: "right", color: "#9ca3af" }}>{Math.round(district.influence[id])}</span>
            </div>
          ))}
          {myId && district.controller !== myId && (
            <div>
              <div style={S.row}>
                <input style={{ ...S.input, marginTop: 6, flex: 1 }} value={stake} inputMode="numeric"
                  onChange={(e) => setStake(e.target.value.replace(/[^0-9]/g, ""))} placeholder="War bonds (CITY)" />
              </div>
              <button
                style={{ ...S.btn, background: FACTIONS[myId].color }}
                onClick={() => store.declareTurfWar(district.id, parseInt(stake || "0", 10))}
              >
                Declare turf war — {stake || 0} CITY bonds
              </button>
            </div>
          )}
        </div>
      )}
      <div style={S.card}>
        <p style={S.title}>Open wars ({wars.length})</p>
        {wars.length === 0 && <p style={S.sub}>No blood on the streets right now.</p>}
        {wars.map((w) => {
          const d = state.districts.find((x) => x.id === w.districtId);
          return (
            <div key={w.id} style={{ borderTop: "1px solid #1f2937", paddingTop: 8, marginTop: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>
                <span style={{ color: FACTIONS[w.attacker].color }}>{FACTIONS[w.attacker].short}</span>
                {" "}→ {d?.name} {w.defender && <span>vs <span style={{ color: FACTIONS[w.defender].color }}>{FACTIONS[w.defender].short}</span></span>}
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                Bonds: {Object.entries(w.bonds).map(([k, v]) => `${FACTIONS[k as FactionId].short} ${v}`).join(" · ")} ·{" "}
                Rounds left: {w.roundsLeft}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{w.log[w.log.length - 1]}</div>
              <div style={S.row}>
                <button style={{ ...S.btnGhost, flex: 1 }} onClick={() => store.stakeWar(w.id, 50)}>+50 bonds</button>
                <button style={{ ...S.btnGhost, flex: 1 }} onClick={() => store.advanceWar(w.id)}>Fight round</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------- graffiti ------------------------------- */

function GraffitiPanel() {
  const [state, store] = useFactions();
  const myId = state.player.factionId;
  const [gwTab, setGwTab] = useState<"walls" | "wars">("walls");
  return (
    <div>
      <div style={{ ...S.row, marginBottom: 10 }}>
        {(["walls", "wars"] as const).map((t) => (
          <button key={t} onClick={() => setGwTab(t)}
            style={{ ...S.tab, ...(gwTab === t ? S.tabOn : {}) }}>{t === "walls" ? "Walls" : "Crew wars"}</button>
        ))}
      </div>
      {gwTab === "walls" ? (
        <div>
          <div style={S.card}>
            <p style={S.title}>Crew buff</p>
            <p style={S.sub}>
              {myId
                ? `Your firm holds ${state.walls.filter((w) => w.heldBy === myId).length} walls → +${(store.playerWallBuff() * 100).toFixed(0)}% paper earnings.`
                : "Join a firm to earn wall buffs."}
            </p>
          </div>
          {state.walls.map((w) => (
            <div key={w.id} style={S.card}>
              <div style={S.row}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>{w.name}</div>
                  <div style={S.sub}>{state.districts.find((d) => d.id === w.districtId)?.name} · {w.tagCount} tags</div>
                </div>
                <FirmChip id={w.heldBy} />
              </div>
              {myId && (
                <button
                  style={{ ...S.btnGhost, borderColor: FACTIONS[myId].color }}
                  onClick={() => store.tag(w.id, playerLabel())}
                >
                  {w.heldBy === myId ? `Re-tag (${TAG_COST} CITY)` : w.heldBy ? `Overpaint (${OVERPAINT_COST} CITY)` : `Tag it (${TAG_COST} CITY)`}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <GraffitiWarPanel />
      )}
    </div>
  );
}

function GraffitiWarPanel() {
  const [state, store] = useFactions();
  const myId = state.player.factionId;
  const [pot, setPot] = useState("150");
  const [wallId, setWallId] = useState(state.walls[0]?.id ?? "");
  const open = state.graffitiWars.filter((w) => w.status !== "judged");
  const judged = state.graffitiWars.filter((w) => w.status === "judged").slice(0, 5);
  return (
    <div>
      {myId && (
        <div style={S.card}>
          <p style={S.title}>Challenge a rival crew</p>
          <select style={S.input} value={wallId} onChange={(e) => setWallId(e.target.value)}>
            {state.walls.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <div style={S.row}>
            <input style={{ ...S.input, flex: 1 }} value={pot} inputMode="numeric"
              onChange={(e) => setPot(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Prize pot (CITY)" />
            <button style={{ ...S.btn, width: "auto", marginTop: 6, background: FACTIONS[myId].color }}
              onClick={() => store.challenge(wallId, parseInt(pot || "0", 10))}>Throw down</button>
          </div>
        </div>
      )}
      {open.map((w) => <WarCard key={w.id} war={w} />)}
      {judged.length > 0 && (
        <div style={S.card}>
          <p style={S.title}>Judged</p>
          {judged.map((w) => (
            <div key={w.id} style={{ fontSize: 12, marginBottom: 6 }}>
              <b style={{ color: w.winner ? FACTIONS[w.winner].color : "#9ca3af" }}>
                {w.winner ? FACTIONS[w.winner].short : "DRAW"}
              </b>{" "}
              — {w.judgeNote}
            </div>
          ))}
        </div>
      )}
      {open.length === 0 && judged.length === 0 && <p style={S.sub}>No crew wars yet. Start one.</p>}
    </div>
  );
}

function WarCard({ war }: { war: GraffitiWar }) {
  const [state, store] = useFactions();
  const wall = state.walls.find((w) => w.id === war.wallId);
  const myId = state.player.factionId;
  const mine = myId === war.crewA || myId === war.crewB;
  const secsLeft = war.startedAt ? Math.max(0, war.durationSec - Math.floor((Date.now() - war.startedAt) / 1000)) : war.durationSec;
  return (
    <div style={S.card}>
      <div style={{ fontWeight: 800 }}>
        <span style={{ color: FACTIONS[war.crewA].color }}>{FACTIONS[war.crewA].short}</span>
        {" "}vs{" "}
        <span style={{ color: FACTIONS[war.crewB].color }}>{FACTIONS[war.crewB].short}</span>
      </div>
      <div style={S.sub}>{wall?.name} · pot {war.pot} CITY · {war.status === "live" ? `${secsLeft}s left` : "awaiting start"}</div>
      <div style={{ fontSize: 12 }}>Style: {war.tagsA} — {war.tagsB}</div>
      {war.status === "challenge" && (
        <button style={S.btn} onClick={() => store.startGraffitiWar(war.id)}>Start the tag-off (60s)</button>
      )}
      {war.status === "live" && mine && (
        <button style={{ ...S.btn, background: FACTIONS[myId!].color }} onClick={() => store.warTag(war.id, playerLabel())}>
          Throw up a piece
        </button>
      )}
      {war.status === "live" && !mine && <p style={S.sub}>Spectating — the city judges when the clock dies.</p>}
    </div>
  );
}

/* -------------------------------- elections ------------------------------ */

function fmtLeft(ms: number): string {
  if (ms <= 0) return "tallying…";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return `${d}d ${h}h left`;
}

function ElectionPanel() {
  const [state, store] = useFactions();
  const el = state.election;
  const [votes, setVotes] = useState("5");
  const [sel, setSel] = useState(el.candidates[0]?.id ?? "");
  const [runName, setRunName] = useState("");
  const [runPlatform, setRunPlatform] = useState("");
  const total = el.candidates.reduce((s, c) => s + c.votes + c.pendingVotes, 0) || 1;
  const o = state.office;
  return (
    <div>
      <div style={S.card}>
        <p style={S.title}>Mayor of OrbitXCity</p>
        <div style={{ fontSize: 13 }}>
          <b>{o.holderName}</b> holds office · burn tax <b>{o.burnTaxPct}%</b> · fee-share <b>{o.feeShareMultiplier}×</b>
        </div>
        <p style={S.sub}>Term {el.term} · {fmtLeft(msUntilTermEnd(el))} · 1 ORBITX = 1 vote (burned)</p>
      </div>
      {el.candidates.map((c) => (
        <div key={c.id} style={{ ...S.card, borderColor: sel === c.id ? "#22d3ee" : "#1f2937" }}>
          <div style={S.row}>
            {c.factionId && <Logo id={c.factionId} size={26} />}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800 }}>{c.name} {c.factionId && <FirmChip id={c.factionId} />}</div>
              <div style={S.sub}>"{c.platform}"</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <div style={{ ...S.bar, flex: 1, marginTop: 0 }}>
              <div style={{ width: `${((c.votes + c.pendingVotes) / total) * 100}%`, height: "100%", background: "#22d3ee" }} />
            </div>
            <span>{c.votes + c.pendingVotes}</span>
          </div>
          {c.pendingVotes > 0 && <div style={{ fontSize: 11, color: "#f59e0b" }}>{c.pendingVotes} pending ORBITX settlement</div>}
          <button style={S.btnGhost} onClick={() => setSel(c.id)}>
            {sel === c.id ? "✓ backing" : "Back this candidate"}
          </button>
        </div>
      ))}
      <div style={S.card}>
        <p style={S.title}>Cast votes</p>
        <div style={S.row}>
          <input style={{ ...S.input, marginTop: 0, flex: 1 }} value={votes} inputMode="numeric"
            onChange={(e) => setVotes(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Votes" />
          <button style={{ ...S.btn, width: "auto", marginTop: 0 }}
            onClick={() => sel && store.vote(sel, parseInt(votes || "0", 10))}>
            Vote — {(parseInt(votes || "0", 10) || 0) * VOTE_COST_ORBITX} ORBITX
          </button>
        </div>
        <p style={S.sub}>Votes burn real ORBITX. Settlement is pending the tokenomics billing primitive — pledges are recorded on-chain-ready now.</p>
      </div>
      <div style={S.card}>
        <p style={S.title}>Run for mayor</p>
        <input style={S.input} value={runName} onChange={(e) => setRunName(e.target.value)} placeholder="Your name" />
        <input style={S.input} value={runPlatform} onChange={(e) => setRunPlatform(e.target.value)} placeholder="Platform (140 chars)" />
        <button style={S.btn} onClick={() => runName.trim() && store.runForMayor(runName.trim(), runPlatform)}>
          Declare candidacy
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------- root ---------------------------------- */

type Tab = "firms" | "turf" | "walls" | "mayor";

export function FactionsRoot({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState<Tab>("firms");
  const tabs: Array<[Tab, string]> = [
    ["firms", "Firms"],
    ["turf", "Turf"],
    ["walls", "Walls"],
    ["mayor", "Mayor"],
  ];
  return (
    <div style={S.root}>
      <div style={{ ...S.header, justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 4, flex: 1 }}>
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ ...S.tab, ...(tab === id ? S.tabOn : {}) }}>
              {label}
            </button>
          ))}
        </div>
        {onClose && (
          <button onClick={onClose} style={{ ...S.tab, flex: "0 0 auto", padding: "10px 12px" }}>✕</button>
        )}
      </div>
      <div style={S.body}>
        {tab === "firms" && <FirmPanel />}
        {tab === "turf" && <TurfPanel />}
        {tab === "walls" && <GraffitiPanel />}
        {tab === "mayor" && <ElectionPanel />}
      </div>
    </div>
  );
}

/**
 * Compact turf badge for the core HUD: shows the player's firm colors and
 * how many districts the firm controls. Integrator may drop this anywhere
 * in the HUD layer.
 */
export function FirmBadge() {
  const [state] = useFactions();
  const p = state.player;
  if (!p.factionId) return null;
  const f = FACTIONS[p.factionId];
  const controlled = state.districts.filter((d) => d.controller === p.factionId).length;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
      borderRadius: 999, background: "rgba(11,15,26,0.8)", border: `1px solid ${f.color}`,
      fontSize: 11, fontWeight: 800, color: "#fff",
    }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: f.color }} />
      {f.short} · {controlled}/5 turf
    </div>
  );
}

// re-export judgeWar for integrators running background war clocks
export { judgeWar };
