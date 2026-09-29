import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderLock, Lock, Plus, X, Check } from "lucide-react";
import { APP_CATALOG, type OsHomeApp } from "./appsCatalog";
import {
  hasVaultPattern,
  isVaultUnlocked,
  setVaultPattern,
  unlockVault,
  lockVault,
  getVaultApps,
  setVaultApps,
  clearVaultPattern,
  type VaultPattern,
} from "../themes/vault";
import "./oshome.css";

/**
 * Private vault UI (idea 34).
 *
 *  PatternPad   — 3×3 draw pad (setup: draw twice to confirm; unlock: draw once)
 *  VaultTile    — the 🔒 tile that lives on the home grid
 *  VaultSheet   — overlay: setup / unlock / manage (add & remove vaulted apps)
 *  useVaultState — reactive { hasPattern, unlocked } for the home filter
 */

export function useVaultState() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    window.addEventListener("orbitx:vault", fn);
    return () => window.removeEventListener("orbitx:vault", fn);
  }, []);
  return useMemo(
    () => ({ hasPattern: hasVaultPattern(), unlocked: isVaultUnlocked(), tick }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick]
  );
}

/* ---------------- 3×3 pattern pad ---------------- */

function PatternPad({ onComplete, resetKey }: { onComplete: (p: VaultPattern) => void; resetKey: number }) {
  const [dots, setDots] = useState<number[]>([]);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    setDots([]);
    setDrawing(false);
  }, [resetKey]);

  const add = (i: number) => {
    if (!drawing) return;
    setDots((d) => (d.includes(i) ? d : [...d, i]));
  };

  const finish = useCallback(() => {
    if (!drawing) return;
    setDrawing(false);
    if (dots.length >= 4) onComplete(dots);
    else setDots([]);
  }, [drawing, dots, onComplete]);

  return (
    <div
      className="osh-pad"
      onPointerDown={(e) => {
        e.preventDefault();
        setDots([]);
        setDrawing(true);
      }}
      onPointerUp={finish}
      onPointerLeave={finish}
      onContextMenu={(e) => e.preventDefault()}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className="osh-pad-dot"
          data-hit={dots.includes(i) || undefined}
          onPointerEnter={() => add(i)}
          onPointerDown={() => add(i)}
        >
          {dots.includes(i) && <span className="osh-pad-n">{dots.indexOf(i) + 1}</span>}
        </div>
      ))}
      <div className="osh-pad-hint">Draw your pattern (4+ dots)</div>
    </div>
  );
}

/* ---------------- the tile on the home grid ---------------- */

export function VaultTile({ onOpen }: { onOpen: () => void }) {
  const { unlocked } = useVaultState();
  return (
    <button className="osh-icon" onClick={onOpen} title="Private vault" aria-label="Private vault">
      <span className="osh-icon-tile">
        {unlocked ? (
          <FolderLock className="osh-icon-glyph" style={{ color: "var(--dt-accent)" }} />
        ) : (
          <Lock className="osh-icon-glyph" style={{ color: "var(--dt-muted)" }} />
        )}
      </span>
      <span className="osh-icon-label">Vault</span>
    </button>
  );
}

/* ---------------- setup / unlock / manage sheet ---------------- */

export function VaultSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { hasPattern, unlocked } = useVaultState();
  const [phase, setPhase] = useState<"setup" | "confirm" | "unlock" | "manage">("unlock");
  const [first, setFirst] = useState<VaultPattern>([]);
  const [padKey, setPadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [vaulted, setVaulted] = useState<string[]>(() => getVaultApps());

  useEffect(() => {
    if (!open) return;
    setError(null);
    setQ("");
    setVaulted(getVaultApps());
    if (!hasVaultPattern()) setPhase("setup");
    else if (isVaultUnlocked()) setPhase("manage");
    else setPhase("unlock");
  }, [open, hasPattern]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);

  if (!open) return null;

  const byId = new Map(APP_CATALOG.map((a) => [a.id, a]));
  const vaultedApps = vaulted.map((id) => byId.get(id)).filter((a): a is OsHomeApp => !!a);
  const addable = APP_CATALOG.filter(
    (a) =>
      !vaulted.includes(a.id) &&
      `${a.name} ${a.blurb}`.toLowerCase().includes(q.trim().toLowerCase())
  );

  const addApp = (id: string) => {
    const next = [...vaulted, id];
    setVaulted(next);
    setVaultApps(next);
  };
  const removeApp = (id: string) => {
    const next = vaulted.filter((v) => v !== id);
    setVaulted(next);
    setVaultApps(next);
  };

  return (
    <div className="osh-launcher" onClick={onClose} role="dialog" aria-label="Private vault">
      <div className="osh-launcher-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="osh-settings-head" style={{ padding: "18px 18px 0" }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>🔒 Private vault</h2>
          <button className="osh-x-btn" onClick={onClose} aria-label="Close vault">
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>

        <div style={{ padding: "6px 18px 22px" }}>
          {error && <div className="osh-vault-err" role="alert">{error}</div>}

          {phase === "setup" && (
            <>
              <p className="osh-vault-sub">Draw a pattern to create your vault. You'll confirm it next.</p>
              <PatternPad
                resetKey={padKey}
                onComplete={(p) => {
                  setFirst(p);
                  setPhase("confirm");
                  setPadKey((k) => k + 1);
                }}
              />
            </>
          )}

          {phase === "confirm" && (
            <>
              <p className="osh-vault-sub">Draw the same pattern once more to confirm.</p>
              <PatternPad
                resetKey={padKey}
                onComplete={async (p) => {
                  if (p.join(",") !== first.join(",")) {
                    setError("Patterns didn't match — try again.");
                    setPhase("setup");
                    setPadKey((k) => k + 1);
                    return;
                  }
                  try {
                    await setVaultPattern(p);
                    setError(null);
                    setPhase("manage");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Couldn't save the pattern");
                  }
                }}
              />
            </>
          )}

          {phase === "unlock" && (
            <>
              <p className="osh-vault-sub">Draw your pattern to unlock the vault.</p>
              <PatternPad
                resetKey={padKey}
                onComplete={async (p) => {
                  const ok = await unlockVault(p);
                  if (ok) {
                    setError(null);
                    setPhase("manage");
                  } else {
                    setError("Wrong pattern — try again.");
                    setPadKey((k) => k + 1);
                  }
                }}
              />
              <button
                className="osh-picker-reset"
                onClick={() => {
                  if (window.confirm("Remove the vault pattern and unhide all apps?")) {
                    clearVaultPattern();
                    onClose();
                  }
                }}
              >
                Remove vault pattern
              </button>
            </>
          )}

          {phase === "manage" && (
            <>
              <p className="osh-vault-sub">
                Vaulted apps stay hidden from the home screen while locked.{" "}
                <button className="osh-link" onClick={() => { lockVault(); onClose(); }}>Lock now</button>
              </p>

              <div className="osh-picker-sec" style={{ marginTop: 6 }}>In the vault ({vaultedApps.length})</div>
              {vaultedApps.length === 0 && (
                <p style={{ fontSize: 12.5, color: "var(--dt-muted)" }}>Empty — add apps below.</p>
              )}
              <div className="osh-vault-list">
                {vaultedApps.map((a) => {
                  const Icon = a.icon;
                  return (
                    <div key={a.id} className="osh-vault-row">
                      <Icon style={{ width: 16, height: 16, color: a.accent }} />
                      <span style={{ fontSize: 13 }}>{a.name}</span>
                      <button className="osh-x-btn" onClick={() => removeApp(a.id)} aria-label={`Remove ${a.name} from vault`}>
                        <X style={{ width: 13, height: 13 }} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="osh-picker-sec">Add apps</div>
              <input
                className="osh-vault-search"
                placeholder="Search apps…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="osh-vault-list" style={{ maxHeight: 180, overflowY: "auto" }}>
                {addable.slice(0, 24).map((a) => {
                  const Icon = a.icon;
                  return (
                    <div key={a.id} className="osh-vault-row">
                      <Icon style={{ width: 16, height: 16, color: a.accent }} />
                      <span style={{ fontSize: 13 }}>{a.name}</span>
                      <button className="osh-x-btn" onClick={() => addApp(a.id)} aria-label={`Add ${a.name} to vault`}>
                        <Plus style={{ width: 13, height: 13 }} />
                      </button>
                    </div>
                  );
                })}
                {addable.length === 0 && (
                  <p style={{ fontSize: 12.5, color: "var(--dt-muted)" }}>No more apps to add.</p>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 12.5, color: "var(--dt-muted)" }}>
                <Check style={{ width: 14, height: 14, color: "var(--dt-accent)" }} />
                Pattern is stored as a salted hash on this device only.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
