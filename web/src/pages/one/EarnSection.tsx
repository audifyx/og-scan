import { useEffect, useState } from "react";
import { useWallet } from "./wallet";
import { fetchBounties, submitProof, isSupabaseConfigured, type BountyTask } from "./supabase";
import { MOCK_BOUNTIES } from "./mock";

const diffClass = (d: string) => (d === "easy" ? "easy" : d === "hard" ? "hard" : "medium");

export default function Earn() {
  const { publicKey } = useWallet();
  const [tasks, setTasks] = useState<BountyTask[]>(MOCK_BOUNTIES);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<BountyTask | null>(null);
  const [proofText, setProofText] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }
      try {
        const { tasks: t, live: l } = await fetchBounties();
        if (t.length) setTasks(t);
        setLive(l);
      } catch (e: any) {
        setErr(e.message ?? "Could not load bounties");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openSubmit = (t: BountyTask) => {
    setActive(t); setProofText(""); setProofUrl(""); setDone(null); setErr(null);
  };

  const doSubmit = async () => {
    if (!active || !publicKey) return;
    if (!proofText.trim()) { setErr("Describe your proof first."); return; }
    setSubmitting(true); setErr(null);
    try {
      await submitProof(active.id, publicKey.toBase58(), proofText.trim(), proofUrl.trim());
      setDone("Proof submitted — reviewers typically respond within 24h.");
    } catch (e: any) {
      setErr(e.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mode-wrap">
      <h2 className="section-title">⚒️ Earn — Bounty Board</h2>
      <p className="section-sub">
        Complete real work, get paid in USDC. Every payout builds your rep — which cuts trading fees and unlocks better bounties.
      </p>

      {!isSupabaseConfigured && (
        <div className="notice">
          Backend not connected yet — showing demo bounties. Set <b>SUPABASE_URL</b> + <b>SUPABASE_ANON_KEY</b> in
          <b> src/config.ts</b> to pull live tasks from <b>bagwork_tasks</b>.
        </div>
      )}
      {live && <div style={{ marginBottom: 18 }}><span className="badge live"><span className="live-dot" /> LIVE FROM BACKEND</span></div>}
      {err && !active && <div className="notice">{err}</div>}

      {loading ? (
        <div className="grid">
          {[0, 1, 2].map((i) => <div key={i} className="card"><div className="skeleton" style={{ height: 120 }} /></div>)}
        </div>
      ) : (
        <div className="grid">
          {tasks.map((t, i) => (
            <div className="card" key={t.id} style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="row-between" style={{ marginBottom: 12 }}>
                <span className={`badge ${diffClass(t.difficulty)}`}>{t.difficulty}</span>
                <span className="badge dim">{t.category}</span>
              </div>
              <h3>{t.title}</h3>
              <p>{t.description}</p>
              <div className="row-between">
                <span className="reward">${t.reward_usdc} <small>USDC</small></span>
                <button
                  className="btn btn-primary"
                  onClick={() => openSubmit(t)}
                  disabled={!publicKey}
                  title={publicKey ? "Submit proof" : "Connect wallet first"}
                >
                  {publicKey ? "Submit proof" : "Connect wallet"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {active && (
        <div className="modal-veil" onClick={() => setActive(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Submit proof</h3>
            <p><b style={{ color: "var(--text)" }}>{active.title}</b> — ${active.reward_usdc} USDC on approval.</p>
            {done ? (
              <>
                <div className="notice" style={{ borderColor: "rgba(23,255,77,.35)", background: "rgba(23,255,77,.07)", color: "#b8ffcb" }}>{done}</div>
                <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setActive(null)}>Close</button></div>
              </>
            ) : (
              <>
                <textarea rows={4} placeholder="What did you do? Link deliverables, describe the work…" value={proofText} onChange={(e) => setProofText(e.target.value)} />
                <input type="text" placeholder="Proof URL (optional)" value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} />
                {err && <div className="notice">{err}</div>}
                <div className="modal-actions">
                  <button className="btn btn-ghost" onClick={() => setActive(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={doSubmit} disabled={submitting}>
                    {submitting ? "Submitting…" : "Submit"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
