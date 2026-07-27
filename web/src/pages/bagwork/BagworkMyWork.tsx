import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { WalletPickerModal } from "@/components/WalletPickerModal";
import { useState } from "react";
import { listMySubmissions } from "@/lib/bagwork/api";
import type { BagworkSubmissionStatus } from "@/lib/bagwork/types";

function StatusBadge({ status }: { status: BagworkSubmissionStatus }) {
  const cls =
    status === "paid" ? "bw-badge--paid"
    : status === "approved" ? "bw-badge--approved"
    : status === "rejected" ? "bw-badge--rejected"
    : "bw-badge--pending";
  return <span className={`bw-badge ${cls}`}>{status}</span>;
}

function shortAddr(a: string) {
  return a.length <= 12 ? a : `${a.slice(0, 4)}…${a.slice(-4)}`;
}

export default function BagworkMyWork() {
  const { user } = useAuth();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [picker, setPicker] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["bagwork-my", user?.id],
    queryFn: () => listMySubmissions(user!.id),
    enabled: !!user?.id,
  });

  const earned = useMemo(() => {
    if (!rows) return 0;
    return rows
      .filter((r) => r.status === "approved" || r.status === "paid")
      .reduce((a, r) => a + Number(r.bagwork_tasks?.reward_usdc ?? 0), 0);
  }, [rows]);

  const pending = useMemo(() => {
    if (!rows) return 0;
    return rows.filter((r) => r.status === "pending").length;
  }, [rows]);

  if (!user?.id) {
    return (
      <div className="bw-card py-16 text-center">
        <p className="mb-4 text-[#A8B0BC]">Connect with Phantom or Jupiter to view your submissions.</p>
        <button type="button" className="bw-btn" onClick={() => setPicker(true)}>Connect wallet</button>
        <WalletPickerModal open={picker} onClose={() => setPicker(false)} wallets={pickable} onPick={async (n) => { await signInWith(n); setPicker(false); }} busy={busy} />
      </div>
    );
  }

  return (
    <>
      <div className="bw-hero">
        <div className="bw-hero-kicker">Your bag work</div>
        <h1 className="bw-hero-title">My submissions</h1>
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="bw-card min-w-[140px]">
            <div className="text-[10px] uppercase tracking-widest text-[#A8B0BC]">Approved / paid</div>
            <div className="mt-1 font-mono text-xl font-bold text-[#F0C75E]">${earned.toFixed(2)}</div>
          </div>
          <div className="bw-card min-w-[140px]">
            <div className="text-[10px] uppercase tracking-widest text-[#A8B0BC]">Pending review</div>
            <div className="mt-1 font-mono text-xl font-bold text-white">{pending}</div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#A8B0BC]" /></div>
      ) : !rows?.length ? (
        <div className="bw-card py-12 text-center text-[#A8B0BC]">
          No submissions yet. <Link to="/bagwork" className="text-[#60A5FA] hover:underline">Browse tasks</Link>
        </div>
      ) : (
        <div className="bw-card overflow-x-auto">
          <table className="bw-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Reward</th>
                <th>Payout wallet</th>
                <th>Status</th>
                <th>Proof</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold">{r.bagwork_tasks?.title ?? "—"}</td>
                  <td className="font-mono text-[#F0C75E]">${Number(r.bagwork_tasks?.reward_usdc ?? 0).toFixed(2)}</td>
                  <td className="font-mono text-xs">{shortAddr(r.wallet_address)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="max-w-[200px] text-xs text-[#A8B0BC]">
                    {r.proof_url ? (
                      <a href={r.proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#60A5FA] hover:underline">
                        View file <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                    {r.proof_text && <div className="mt-1 truncate">{r.proof_text}</div>}
                    {r.admin_note && r.status === "rejected" && (
                      <div className="mt-1 text-[#ff4d6d]">Note: {r.admin_note}</div>
                    )}
                  </td>
                  <td className="text-xs text-[#A8B0BC]">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
