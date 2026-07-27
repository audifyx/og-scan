import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Loader2, Upload, DollarSign, X, Share2, PenLine, Bug, Blocks,
  Palette, Search, Briefcase, Sparkles, Zap,
} from "lucide-react";
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
import { BAGWORK_CATEGORIES, type BagworkDifficulty, type BagworkTask } from "@/lib/bagwork/types";

const CAT_ICON: Record<string, typeof Briefcase> = {
  social: Share2,
  content: PenLine,
  qa: Bug,
  onchain: Blocks,
  design: Palette,
  research: Search,
  general: Briefcase,
};

function difficultyOf(t: BagworkTask): BagworkDifficulty {
  const d = (t.difficulty || "medium").toLowerCase();
  if (d === "easy" || d === "hard" || d === "expert") return d;
  return "medium";
}

function rarityLabel(d: BagworkDifficulty) {
  if (d === "easy") return "Common";
  if (d === "medium") return "Uncommon";
  if (d === "hard") return "Rare";
  return "Legendary";
}

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
  const diff = difficultyOf(task);
  const Icon = CAT_ICON[task.category || "general"] || Briefcase;

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
          <div className="flex gap-3">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border bg-black/50 bw-poke--${diff}`}
              style={{ borderColor: "var(--poke-rim)", color: "var(--poke-rim)" }}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <div className="bw-hero-kicker">Submit work</div>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight" style={{ fontFamily: "Syne, sans-serif" }}>{task.title}</h2>
              <div className="mt-1 font-mono text-sm font-bold text-[#F0C75E]">
                ${Number(task.reward_usdc).toFixed(2)} USDC · {rarityLabel(diff)}
              </div>
            </div>
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

function TaskCard({ task, onOpen }: { task: BagworkTask; onOpen: () => void }) {
  const diff = difficultyOf(task);
  const Icon = CAT_ICON[task.category || "general"] || Briefcase;
  const cat = (task.category || "general").replace(/_/g, " ");
  const reward = Number(task.reward_usdc);

  return (
    <article className={`bw-poke bw-poke--${diff}`}>
      <div className="bw-poke-frame">
        <div className="bw-poke-top">
          <h2 className="bw-poke-name">{task.title}</h2>
          <div className="bw-poke-hp">
            <span className="bw-poke-hp-label">Reward</span>
            <span className="bw-poke-hp-val">${reward.toFixed(reward % 1 ? 2 : 0)}</span>
            <span className="bw-poke-hp-unit">USDC</span>
          </div>
        </div>

        <div className="bw-poke-art">
          <span className="bw-poke-rarity">{rarityLabel(diff)}</span>
          <div className="bw-poke-art-icon">
            <Icon className="h-7 w-7" strokeWidth={2.2} />
          </div>
        </div>

        <div className="bw-poke-body">
          <div className="bw-poke-types">
            <span className="bw-type bw-type--cat">{cat}</span>
            <span className="bw-type">{diff}</span>
            {(task.tags ?? []).slice(0, 2).map((tag) => (
              <span key={tag} className="bw-type">{tag}</span>
            ))}
          </div>
          <p className="bw-poke-desc">{task.description || task.instructions || "Complete this task and submit proof to earn USDC."}</p>
          <div className="bw-poke-attack">
            <span className="bw-poke-attack-label">Submit work</span>
            <span className="bw-poke-attack-dmg">+{reward.toFixed(2)}</span>
          </div>
          <button type="button" className="bw-btn" onClick={onOpen}>
            <Zap className="h-3.5 w-3.5" /> Claim &amp; submit
          </button>
        </div>
      </div>
    </article>
  );
}

export default function BagworkHome() {
  const { user } = useAuth();
  const { publicKey, connected } = useWallet();
  const { pickable, signInWith, busy: walletBusy } = useWalletSignIn();
  const [picker, setPicker] = useState(false);
  const [activeTask, setActiveTask] = useState<BagworkTask | null>(null);
  const [category, setCategory] = useState("all");

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["bagwork-tasks"],
    queryFn: listActiveTasks,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    if (!tasks) return [];
    if (category === "all") return tasks;
    return tasks.filter((t) => (t.category || "general") === category);
  }, [tasks, category]);

  const totalPool = useMemo(
    () => (tasks ?? []).reduce((a, t) => a + Number(t.reward_usdc || 0), 0),
    [tasks],
  );

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
        <div className="bw-hero-kicker">
          <Sparkles className="mr-1 inline h-3 w-3" /> Collectible task cards
        </div>
        <h1 className="bw-hero-title">Bag the work. Collect the USDC.</h1>
        <p className="bw-hero-sub">
          High-rarity task cards on the OrbitX metal desk — pick a card, complete the mission,
          upload proof, get paid in USDC to your Solana wallet.
        </p>
        <div className="bw-hero-stats">
          <div className="bw-stat">
            <div className="bw-stat-label">Live cards</div>
            <div className="bw-stat-val">{tasks?.length ?? "—"}</div>
          </div>
          <div className="bw-stat">
            <div className="bw-stat-label">Reward pool</div>
            <div className="bw-stat-val">${totalPool.toFixed(0)}</div>
          </div>
          <div className="bw-stat">
            <div className="bw-stat-label">Payout</div>
            <div className="bw-stat-val" style={{ fontSize: "1rem" }}>USDC</div>
          </div>
        </div>
        {!connected && (
          <button type="button" className="bw-btn mt-5" onClick={() => setPicker(true)}>
            <DollarSign className="h-4 w-4" /> Connect wallet to start
          </button>
        )}
        {user?.id && (
          <p className="mt-4 text-xs text-[#A8B0BC]">
            Track submissions on{" "}
            <Link to="/bagwork/my" className="text-[#60A5FA] underline-offset-2 hover:underline">My work</Link>.
          </p>
        )}
      </div>

      <div className="bw-filters" role="tablist" aria-label="Categories">
        {BAGWORK_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            className={category === c.id ? "bw-chip bw-chip--on" : "bw-chip"}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20 text-[#A8B0BC]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !filtered.length ? (
        <div className="bw-card py-16 text-center text-[#A8B0BC]">
          {tasks?.length ? "No cards in this category." : "No active task cards yet — check back soon."}
        </div>
      ) : (
        <div className="bw-task-grid">
          {filtered.map((t) => (
            <TaskCard key={t.id} task={t} onOpen={() => openTask(t)} />
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
