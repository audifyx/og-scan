import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { approveBounty, insertBounty, listBounties, submitBountyProof } from "@/lib/launchpad/registry";

type Bounty = {
  id: string;
  title: string;
  reward_amount: number;
  reward_mint: string;
  status: string;
  proof_url?: string | null;
  worker_wallet?: string | null;
};

export function BagworkBoard({
  mint,
  isAdmin,
  wallet,
  xHandle,
}: {
  mint: string;
  isAdmin: boolean;
  wallet: string | null;
  xHandle?: string | null;
}) {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["pad-bounties", mint],
    queryFn: () => listBounties(mint) as Promise<Bounty[]>,
    refetchInterval: 20_000,
  });
  const [title, setTitle] = useState("");
  const [reward, setReward] = useState("1");
  const [proof, setProof] = useState<Record<string, string>>({});

  const refresh = () => qc.invalidateQueries({ queryKey: ["pad-bounties", mint] });

  return (
    <section className="lp-bagwork">
      <div className="lp-field-label">Bagwork board</div>
      <p className="lp-auth-copy">Fees fund work after the chart dies. Admin (launching X) posts a task; workers submit an X URL; admin approves. Receipt is public. No protocol token.</p>
      {isAdmin && (
        <form
          className="lp-bagwork-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await insertBounty({
                mint,
                title: title.trim(),
                reward_amount: Number(reward) || 0,
                reward_mint: "So11111111111111111111111111111111111111112",
                created_by_wallet: wallet ?? undefined,
              });
              setTitle("");
              toast.success("Bounty posted");
              refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not post bounty");
            }
          }}
        >
          <input className="lp-input" placeholder="Task" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <input className="lp-input" placeholder="Reward" value={reward} onChange={(e) => setReward(e.target.value)} />
          <button type="submit" className="lp-auth-btn" disabled={!title.trim()}>Post</button>
        </form>
      )}
      <ul className="lp-bagwork-list">
        {rows.length === 0 && <li className="lp-auth-copy">No bounties yet.</li>}
        {rows.map((b) => (
          <li key={b.id} className="lp-bagwork-row">
            <div>
              <div className="font-bold">{b.title}</div>
              <div className="lp-auth-copy">{b.reward_amount} · {b.status}</div>
            </div>
            {b.status === "open" && wallet && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await submitBountyProof(b.id, proof[b.id] || "", wallet, xHandle ?? undefined);
                    toast.success("Proof submitted");
                    refresh();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Submit failed");
                  }
                }}
              >
                <input
                  className="lp-input"
                  placeholder="https://x.com/…"
                  value={proof[b.id] || ""}
                  onChange={(e) => setProof((p) => ({ ...p, [b.id]: e.target.value }))}
                />
                <button type="submit" className="lp-auth-btn">Submit X URL</button>
              </form>
            )}
            {isAdmin && b.status === "submitted" && (
              <button
                type="button"
                className="lp-auth-btn"
                onClick={async () => {
                  await approveBounty(b.id);
                  toast.success("Approved — ledger updated");
                  refresh();
                }}
              >
                Approve
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
