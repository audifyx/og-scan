import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { Loader2, Upload, DollarSign, X } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { WalletPickerModal } from "@/components/WalletPickerModal";
import {
  listActiveTasks,
  createSubmission,
  uploadProofFile,
  countUserSubmissionsForTask,
  isLikelySolanaAddress,
} from "@/lib/bagwork/api";
import type { BagworkTask } from "@/lib/bagwork/types";

function SubmitModal({
  task,
  onClose,
  defaultWallet,
}: {
  task: BagworkTask;
  onClose: () => void;
  defaultWallet: string;
}) {
  const { user } = useAuth();
  const [wallet, setWallet] = useState(defaultWallet);
  const [proofText, setProofText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const submit = async () => {
    if (!user?.id) {
      toast.error("Sign in with Phantom or Jupiter first");
      return;
    }
    if (!isLikelySolanaAddress(wallet)) {
      toast.error("Enter a valid Solana wallet address for USDC payout");
      return;
    }
    if (!proofText.trim() && !file) {
      toast.error("Add proof text or upload a screenshot / file");
      return;
    }
    setBusy(true);
    try {
      if (task.max_submissions_per_user != null) {
        const n = await countUserSubmissionsForTask(user.id, task.id);
        if (n >= task.max_submissions_per_user) {
          toast.error("You reached the submission limit for this task");
          return;
        }
      }
      let proofUrl: string | undefined;
      let proofFileName: string | undefined;
      if (file) {
        const up = await uploadProofFile(user.id, file);
        proofUrl = up.url;
        proofFileName = up.fileName;
      }
      await createSubmission({
        taskId: task.id,
        userId: user.id,
        walletAddress: wallet,
        proofText,
        proofUrl,
        proofFileName,
      });
      toast.success("Submission sent — pending review");
      qc.invalidateQueries({ queryKey: ["bagwork-my"] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bw-modal-backdrop" onClick={onClose}>
      <div className="bw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="bw-hero-kicker">Submit work</div>
            <h2 className="bw-task-title mt-1">{task.title}</h2>
            <div className="bw-task-reward mt-1">${Number(task.reward_usdc).toFixed(2)} USDC</div>
          </div>
          <button type="button" onClick={onClose} className="text-[#A8B0BC] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {task.instructions && (
          <p className="mb-4 text-sm leading-relaxed text-[#A8B0BC]">{task.instructions}</p>
        )}

        <label className="mb-3 block">
          <span className="bw-label">USDC payout wallet (Solana)</span>
          <input className="bw-input font-mono text-sm" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Your Solana address…" />
        </label>

        <label className="mb-3 block">
          <span className="bw-label">Proof / notes</span>
          <textarea className="bw-input min-h-[88px] resize-y" value={proofText} onChange={(e) => setProofText(e.target.value)} placeholder="Link, description, or what you completed…" />
        </label>

        <label className="mb-5 block">
          <span className="bw-label">Upload screenshot (optional)</span>
          <input
            type="file"
            accept="image/*,video/*,.pdf"
            className="bw-input text-sm file:mr-3 file:rounded file:border-0 file:bg-[#1a1a1a] file:px-3 file:py-1 file:text-xs file:text-white"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <button type="button" className="bw-btn w-full" disabled={busy} onClick={submit}>
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <><Upload className="h-4 w-4" /> Submit for review</>}
        </button>
      </div>
    </div>
  );
}

export default function BagworkHome() {
  const { user } = useAuth();
  const { publicKey, connected } = useWallet();
  const { pickable, signInWith, busy: walletBusy } = useWalletSignIn();
  const [picker, setPicker] = useState(false);
  const [activeTask, setActiveTask] = useState<BagworkTask | null>(null);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["bagwork-tasks"],
    queryFn: listActiveTasks,
    staleTime: 30_000,
  });

  const defaultWallet = useMemo(() => publicKey?.toBase58() ?? "", [publicKey]);

  const onConnect = async (name: string) => {
    try {
      await signInWith(name);
      setPicker(false);
      toast.success("Signed in — you can submit tasks");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
    }
  };

  const openTask = (t: BagworkTask) => {
    if (!user?.id) {
      toast.error("Connect Phantom or Jupiter to submit");
      setPicker(true);
      return;
    }
    setActiveTask(t);
  };

  return (
    <>
      <div className="bw-hero">
        <div className="bw-hero-kicker">Get paid to bag work</div>
        <h1 className="bw-hero-title">Complete tasks. Earn USDC.</h1>
        <p className="bw-hero-sub">
          Pick a task, do the work, upload proof, and get paid in USDC to your Solana wallet.
          Connect with Phantom, Jupiter, or any Wallet Standard wallet.
        </p>
        {!connected && (
          <button type="button" className="bw-btn mt-4" onClick={() => setPicker(true)}>
            <DollarSign className="h-4 w-4" /> Connect wallet to start
          </button>
        )}
        {user?.id && (
          <p className="mt-3 text-xs text-[#A8B0BC]">
            Track submissions on <Link to="/bagwork/my" className="text-[#60A5FA] underline-offset-2 hover:underline">My work</Link>.
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20 text-[#A8B0BC]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !tasks?.length ? (
        <div className="bw-card py-16 text-center text-[#A8B0BC]">No active tasks yet — check back soon.</div>
      ) : (
        <div className="bw-task-grid">
          {tasks.map((t) => (
            <article key={t.id} className="bw-task">
              <div className="bw-task-reward">${Number(t.reward_usdc).toFixed(2)} USDC</div>
              <h2 className="bw-task-title">{t.title}</h2>
              <p className="flex-1 text-sm leading-relaxed text-[#A8B0BC]">{t.description}</p>
              <button type="button" className="bw-btn mt-2 w-full" onClick={() => openTask(t)}>
                Submit work
              </button>
            </article>
          ))}
        </div>
      )}

      {activeTask && (
        <SubmitModal task={activeTask} defaultWallet={defaultWallet} onClose={() => setActiveTask(null)} />
      )}

      <WalletPickerModal open={picker} onClose={() => setPicker(false)} wallets={pickable} onPick={onConnect} busy={walletBusy} />
    </>
  );
}
