import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Check, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  listAllTasksAdmin,
  listAllSubmissionsAdmin,
  upsertTask,
  deleteTask,
  reviewSubmission,
} from "@/lib/bagwork/api";
import type { BagworkSubmission, BagworkSubmissionStatus, BagworkTask, BagworkTaskInput } from "@/lib/bagwork/types";

type Tab = "tasks" | "submissions";

const emptyTask = (): BagworkTaskInput => ({
  title: "",
  description: "",
  instructions: "",
  reward_usdc: 5,
  active: true,
  max_submissions_per_user: null,
  sort_order: 0,
});

function StatusBadge({ status }: { status: BagworkSubmissionStatus }) {
  const cls =
    status === "paid" ? "bw-badge--paid"
    : status === "approved" ? "bw-badge--approved"
    : status === "rejected" ? "bw-badge--rejected"
    : "bw-badge--pending";
  return <span className={`bw-badge ${cls}`}>{status}</span>;
}

export default function BagworkAdmin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("submissions");
  const [form, setForm] = useState<BagworkTaskInput>(emptyTask());
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<BagworkSubmissionStatus | "all">("all");

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["bagwork-admin-tasks"],
    queryFn: listAllTasksAdmin,
  });

  const { data: subs, isLoading: subsLoading } = useQuery({
    queryKey: ["bagwork-admin-subs"],
    queryFn: listAllSubmissionsAdmin,
  });

  const filteredSubs = (subs ?? []).filter((s) => filter === "all" || s.status === filter);

  const saveTask = async () => {
    if (!form.title.trim()) {
      toast.error("Title required");
      return;
    }
    setSaving(true);
    try {
      await upsertTask(form, editId ?? undefined, user?.id);
      toast.success(editId ? "Task updated" : "Task created");
      setForm(emptyTask());
      setEditId(null);
      qc.invalidateQueries({ queryKey: ["bagwork-admin-tasks"] });
      qc.invalidateQueries({ queryKey: ["bagwork-tasks"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed — sign in with owner email");
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (t: BagworkTask) => {
    setEditId(t.id);
    setForm({
      title: t.title,
      description: t.description,
      instructions: t.instructions,
      reward_usdc: Number(t.reward_usdc),
      active: t.active,
      max_submissions_per_user: t.max_submissions_per_user,
      sort_order: t.sort_order,
    });
    setTab("tasks");
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this task and all submissions?")) return;
    try {
      await deleteTask(id);
      toast.success("Task deleted");
      qc.invalidateQueries({ queryKey: ["bagwork-admin-tasks"] });
      qc.invalidateQueries({ queryKey: ["bagwork-tasks"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const review = async (sub: BagworkSubmission, status: BagworkSubmissionStatus, note?: string) => {
    if (!user?.id) return;
    try {
      await reviewSubmission(sub.id, status, note ?? sub.admin_note, user.id);
      toast.success(`Marked ${status}`);
      qc.invalidateQueries({ queryKey: ["bagwork-admin-subs"] });
      qc.invalidateQueries({ queryKey: ["bagwork-my"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Review failed — owner session required");
    }
  };

  return (
    <>
      <div className="bw-hero">
        <div className="bw-hero-kicker">Owner desk</div>
        <h1 className="bw-hero-title">Bagwork admin</h1>
        <p className="bw-hero-sub">Create tasks, set USDC prices, review uploads, approve payouts.</p>
      </div>

      <div className="mb-6 flex gap-2">
        <button type="button" className={`bw-btn ${tab === "submissions" ? "" : "bw-btn-ghost"}`} onClick={() => setTab("submissions")}>
          Submissions ({subs?.length ?? 0})
        </button>
        <button type="button" className={`bw-btn ${tab === "tasks" ? "" : "bw-btn-ghost"}`} onClick={() => setTab("tasks")}>
          Tasks ({tasks?.length ?? 0})
        </button>
      </div>

      {tab === "tasks" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bw-card space-y-3">
            <h2 className="font-bold">{editId ? "Edit task" : "New task"}</h2>
            <label className="block">
              <span className="bw-label">Title</span>
              <input className="bw-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="block">
              <span className="bw-label">Short description</span>
              <textarea className="bw-input min-h-[60px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <label className="block">
              <span className="bw-label">Instructions for workers</span>
              <textarea className="bw-input min-h-[80px]" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="bw-label">Reward (USDC)</span>
                <input type="number" min={0} step={0.01} className="bw-input" value={form.reward_usdc} onChange={(e) => setForm({ ...form, reward_usdc: parseFloat(e.target.value) || 0 })} />
              </label>
              <label className="block">
                <span className="bw-label">Max per user</span>
                <input type="number" min={1} className="bw-input" placeholder="Unlimited" value={form.max_submissions_per_user ?? ""} onChange={(e) => setForm({ ...form, max_submissions_per_user: e.target.value ? parseInt(e.target.value, 10) : null })} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Active on task board
            </label>
            <div className="flex gap-2">
              <button type="button" className="bw-btn flex-1" disabled={saving} onClick={saveTask}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> {editId ? "Update" : "Create"}</>}
              </button>
              {editId && (
                <button type="button" className="bw-btn bw-btn-ghost" onClick={() => { setEditId(null); setForm(emptyTask()); }}>Cancel</button>
              )}
            </div>
          </div>

          <div className="bw-card">
            <h2 className="mb-3 font-bold">All tasks</h2>
            {tasksLoading ? <Loader2 className="animate-spin" /> : (
              <ul className="space-y-2">
                {(tasks ?? []).map((t) => (
                  <li key={t.id} className="flex items-center gap-2 rounded-lg border border-white/10 p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{t.title}</div>
                      <div className="font-mono text-xs text-[#F0C75E]">${Number(t.reward_usdc).toFixed(2)} · {t.active ? "live" : "hidden"}</div>
                    </div>
                    <button type="button" className="text-[#60A5FA] text-xs font-bold uppercase" onClick={() => onEdit(t)}>Edit</button>
                    <button type="button" className="text-[#ff4d6d]" onClick={() => onDelete(t.id)}><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "submissions" && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {(["all", "pending", "approved", "rejected", "paid"] as const).map((f) => (
              <button key={f} type="button" className={`bw-btn text-[10px] ${filter === f ? "" : "bw-btn-ghost"}`} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
          {subsLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="bw-card overflow-x-auto">
              <table className="bw-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>USDC</th>
                    <th>Wallet</th>
                    <th>Proof</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubs.map((s) => (
                    <tr key={s.id}>
                      <td>{s.bagwork_tasks?.title ?? s.task_id.slice(0, 8)}</td>
                      <td className="font-mono text-[#F0C75E]">${Number(s.bagwork_tasks?.reward_usdc ?? 0).toFixed(2)}</td>
                      <td className="max-w-[120px] truncate font-mono text-xs" title={s.wallet_address}>{s.wallet_address}</td>
                      <td className="max-w-[180px] text-xs">
                        {s.proof_url && (
                          <a href={s.proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#60A5FA] hover:underline">
                            File <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {s.proof_text && <div className="mt-1 text-[#A8B0BC]">{s.proof_text}</div>}
                      </td>
                      <td><StatusBadge status={s.status} /></td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {s.status === "pending" && (
                            <>
                              <button type="button" className="bw-btn !px-2 !py-1 text-[9px]" onClick={() => review(s, "approved")}><Check className="h-3 w-3" /> Approve</button>
                              <button type="button" className="bw-btn bw-btn-ghost !px-2 !py-1 text-[9px]" onClick={() => {
                                const note = prompt("Rejection reason (optional):") ?? "";
                                review(s, "rejected", note);
                              }}><X className="h-3 w-3" /> Reject</button>
                            </>
                          )}
                          {s.status === "approved" && (
                            <button type="button" className="bw-btn !px-2 !py-1 text-[9px]" onClick={() => review(s, "paid")}>Mark paid</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredSubs.length && <p className="py-8 text-center text-[#A8B0BC]">No submissions in this filter.</p>}
            </div>
          )}
        </>
      )}
    </>
  );
}
