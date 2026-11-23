"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  use,
} from "react";
import { createClient } from "@/app/utils/supabase";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Save,
  Upload,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Calendar,
  Paperclip,
  X,
  Clock,
} from "lucide-react";
import {
  TASK_STATUSES,
  TASK_TYPES,
  TASK_TYPE_LABELS,
  PERIODS,
  EVIDENCE_BUCKET,
  SIGNED_URL_TTL_SECONDS,
} from "@/app/utils/constants";
import {
  isGreenwashing,
  taskCompletion,
  type EvidenceLite,
} from "@/app/utils/score";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  project_id: string | null;
  assigned_to: string | null;
  dependency: string | null;
  weight: number | null;
  period: string | null;
  due_date: string | null;
  status: string;
  zoho_link: string | null;
  created_at: string | null;
  notes: string | null;
  doc_link: string | null;
  budgeted_cost: number | null;
  actual_cost: number | null;
  variance: number | null;
  recurring: boolean | null;
  phase: string | null;
};

type EvidenceRow = EvidenceLite & {
  file_url: string;
  uploaded_by: string | null;
  uploaded_at: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  can_approve: boolean | null;
};

function TaskWorkbook({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id: projectId, taskId } = use(params);
  const supabase = createClient();

  const [task, setTask] = useState<TaskRow | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Date-change modal state
  const [showDateModal, setShowDateModal] = useState(false);
  const [newDueDate, setNewDueDate] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [savingDate, setSavingDate] = useState(false);

  const fetchTask = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;

    // Both elements are Supabase builders of the same family; no mixed tuple (§0.13).
    const [taskRes, evidenceRes] = await Promise.all([
      supabase.from("tasks").select("*").eq("id", taskId).single(),
      supabase
        .from("evidence")
        .select("*")
        .eq("task_id", taskId)
        .order("uploaded_at", { ascending: false }),
    ]);

    if (taskRes.error) {
      setError(taskRes.error.message);
      setLoading(false);
      return;
    }

    setTask(taskRes.data as TaskRow);
    setEvidence((evidenceRes.data as EvidenceRow[] | null) ?? []);

    if (userId) {
      const profileRes = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      setMe((profileRes.data as Profile | null) ?? null);
    } else {
      setMe(null);
    }

    setLoading(false);
  }, [taskId, supabase]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  // Sign URLs for all evidence whenever evidence changes
  useEffect(() => {
    if (evidence.length === 0) {
      setSignedUrls({});
      return;
    }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        evidence.map(async (e) => {
          const { data, error: signErr } = await supabase.storage
            .from(EVIDENCE_BUCKET)
            .createSignedUrl(e.file_url, SIGNED_URL_TTL_SECONDS);
          if (signErr || !data) return [e.id, ""] as const;
          return [e.id, data.signedUrl] as const;
        })
      );
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const [k, v] of entries) {
        if (v) map[k] = v;
      }
      setSignedUrls(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [evidence, supabase]);

  const hasVerifiedEvidence = useMemo(
    () => evidence.some((e) => e.verified_by_manager === true),
    [evidence]
  );

  const completion = task
    ? taskCompletion({ status: task.status }, hasVerifiedEvidence)
    : 0;
  const greenwashing = task
    ? isGreenwashing({ status: task.status }, hasVerifiedEvidence)
    : false;

  const canVerify = me?.role === "manager" || me?.can_approve === true;

  const updateField = async (
    patch: Partial<
      Pick<
        TaskRow,
        | "title"
        | "description"
        | "task_type"
        | "assigned_to"
        | "dependency"
        | "weight"
        | "period"
        | "due_date"
        | "status"
        | "zoho_link"
        | "notes"
        | "doc_link"
        | "budgeted_cost"
        | "actual_cost"
        | "recurring"
        | "phase"
      >
    >
  ) => {
    if (!task) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const { error: updateErr } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", task.id);

    if (updateErr) {
      setError(updateErr.message);
    } else {
      setTask({ ...task, ...patch });
      setSuccessMsg("Saved.");
      setTimeout(() => setSuccessMsg(null), 1800);
    }
    setSaving(false);
  };

  const handleCostBlur = async (
    field: "budgeted_cost" | "actual_cost",
    raw: string
  ) => {
    if (!task) return;
    const value = raw.trim() === "" ? null : Number(raw);
    if (value !== null && Number.isNaN(value)) {
      setError("Cost must be a number.");
      return;
    }
    const budgeted = field === "budgeted_cost" ? value : task.budgeted_cost;
    const actual = field === "actual_cost" ? value : task.actual_cost;
    const variance =
      budgeted !== null && actual !== null ? budgeted - actual : null;
    await updateField({
      [field]: value,
      variance,
    } as Partial<TaskRow>);
  };

  const handleUpload = async (file: File) => {
    if (!task) return;
    setUploading(true);
    setError(null);

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;

    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${task.id}/${Date.now()}-${sanitized}`;

    const { error: uploadErr } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(path, file, { upsert: false });

    if (uploadErr) {
      setError(uploadErr.message);
      setUploading(false);
      return;
    }

    const { error: insertErr } = await supabase.from("evidence").insert({
      task_id: task.id,
      file_url: path,
      uploaded_by: userId,
      verified_by_manager: false,
    });

    if (insertErr) {
      setError(insertErr.message);
    } else {
      // §4: evidence upload advances status to Pending Evidence unless already Verified
      if (task.status !== "Verified") {
        await supabase
          .from("tasks")
          .update({ status: "Pending Evidence" })
          .eq("id", task.id);
      }
      await fetchTask();
    }

    setUploading(false);
  };

  const verifyEvidence = async (evidenceId: string) => {
    if (!task || !canVerify) return;
    setVerifyingId(evidenceId);
    setError(null);

    const { error: verifyErr } = await supabase
      .from("evidence")
      .update({ verified_by_manager: true })
      .eq("id", evidenceId);

    if (verifyErr) {
      setError(verifyErr.message);
      setVerifyingId(null);
      return;
    }

    // §4: once at least one evidence is verified, task moves to Verified
    const { error: taskErr } = await supabase
      .from("tasks")
      .update({ status: "Verified" })
      .eq("id", task.id);

    if (taskErr) {
      setError(taskErr.message);
    } else {
      await fetchTask();
    }

    setVerifyingId(null);
  };

  const handleDeleteEvidence = async (evidenceId: string, filePath: string) => {
    if (!task) return;
    if (!confirm("Delete this evidence file?")) return;
    setError(null);

    const { error: removeErr } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .remove([filePath]);

    if (removeErr) {
      setError(removeErr.message);
      return;
    }

    const { error: delErr } = await supabase
      .from("evidence")
      .delete()
      .eq("id", evidenceId);

    if (delErr) {
      setError(delErr.message);
    } else {
      await fetchTask();
    }
  };

  const openDateModal = () => {
    if (!task) return;
    setNewDueDate(task.due_date ?? "");
    setChangeReason("");
    setShowDateModal(true);
  };

  const submitDateChange = async () => {
    if (!task) return;
    if (!newDueDate) {
      setError("New due date is required.");
      return;
    }
    if (!changeReason.trim()) {
      setError("Reason is required.");
      return;
    }
    setSavingDate(true);
    setError(null);

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;

    const oldDate = task.due_date;

    const { error: logErr } = await supabase.from("timeline_logs").insert({
      task_id: task.id,
      old_date: oldDate,
      new_date: newDueDate,
      reason: changeReason.trim(),
      changed_by: userId,
    });

    if (logErr) {
      setError(logErr.message);
      setSavingDate(false);
      return;
    }

    const { error: updateErr } = await supabase
      .from("tasks")
      .update({ due_date: newDueDate })
      .eq("id", task.id);

    if (updateErr) {
      setError(updateErr.message);
    } else {
      setTask({ ...task, due_date: newDueDate });
      setShowDateModal(false);
    }

    setSavingDate(false);
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    if (!confirm("Delete this task permanently? This cannot be undone.")) return;
    setDeleting(true);
    setError(null);

    // Remove evidence files first (best-effort), then rows, then task
    const paths = evidence.map((e) => e.file_url).filter(Boolean);
    if (paths.length > 0) {
      await supabase.storage.from(EVIDENCE_BUCKET).remove(paths);
    }
    await supabase.from("evidence").delete().eq("task_id", task.id);
    const { error: delErr } = await supabase
      .from("tasks")
      .delete()
      .eq("id", task.id);

    if (delErr) {
      setError(delErr.message);
      setDeleting(false);
      return;
    }

    window.location.href = `/dashboard/projects/${projectId}`;
  };

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="animate-spin text-blue-500" size={28} />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-12 text-slate-400">
        Task not found.{" "}
        <Link
          href={`/dashboard/projects/${projectId}`}
          className="text-blue-400 hover:underline"
        >
          Back to project
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 max-w-5xl mx-auto">
      <Link
        href={`/dashboard/projects/${projectId}`}
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm"
      >
        <ArrowLeft size={16} /> Back to Project
      </Link>

      <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-300">
                {TASK_TYPE_LABELS[task.task_type as keyof typeof TASK_TYPE_LABELS] ??
                  task.task_type}
              </span>
              {task.phase && (
                <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {task.phase}
                </span>
              )}
              {greenwashing && (
                <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                  <AlertTriangle size={12} /> Unverified
                </span>
              )}
              {task.status === "Verified" && hasVerifiedEvidence && (
                <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                  <CheckCircle2 size={12} /> Verified
                </span>
              )}
            </div>
            <input
              type="text"
              defaultValue={task.title}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== task.title) updateField({ title: v });
              }}
              className="text-2xl font-bold text-white w-full bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 focus:outline-none pb-1"
            />
            <p className="text-xs text-slate-500 mt-2">
              Completion:{" "}
              <span
                className={
                  completion === 100
                    ? "text-emerald-400"
                    : completion === 50
                      ? "text-amber-400"
                      : "text-slate-400"
                }
              >
                {completion}%
              </span>
              {" • "}
              Weight {task.weight ?? 1}
            </p>
          </div>
          <button
            onClick={handleDeleteTask}
            disabled={deleting}
            className="px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 text-sm rounded-lg border border-red-500/30 flex items-center gap-2 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Trash2 size={16} />
            )}
            Delete Task
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/50 rounded-xl text-emerald-400 text-sm">
          {successMsg}
        </div>
      )}

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
          Details
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Status</span>
            <select
              value={task.status}
              onChange={(e) => updateField({ status: e.target.value })}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Task Type</span>
            <select
              value={task.task_type}
              onChange={(e) => updateField({ task_type: e.target.value })}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TASK_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Period</span>
            <select
              value={task.period ?? "N/A"}
              onChange={(e) => updateField({ period: e.target.value })}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Weight (1–3)</span>
            <input
              type="number"
              min={1}
              max={3}
              defaultValue={task.weight ?? ""}
              onBlur={(e) => {
                const raw = e.target.value.trim();
                const n = raw === "" ? null : Number(raw);
                if (n !== null && (Number.isNaN(n) || n < 1 || n > 3)) {
                  setError("Weight must be between 1 and 3.");
                  return;
                }
                if (n !== task.weight) updateField({ weight: n });
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Due Date</span>
            <div className="flex gap-2">
              <input
                type="date"
                defaultValue={task.due_date ?? ""}
                onBlur={(e) => {
                  const v = e.target.value || null;
                  if (v !== task.due_date) updateField({ due_date: v });
                }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 flex-1"
              />
              <button
                onClick={openDateModal}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-lg flex items-center gap-1"
                title="Change date with reason (writes timeline log)"
              >
                <Calendar size={14} /> Reschedule
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Recurring</span>
            <select
              value={task.recurring ? "yes" : "no"}
              onChange={(e) =>
                updateField({ recurring: e.target.value === "yes" })
              }
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Description</span>
          <textarea
            defaultValue={task.description ?? ""}
            onBlur={(e) => {
              const v = e.target.value || null;
              if (v !== task.description) updateField({ description: v });
            }}
            rows={3}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Notes</span>
          <textarea
            defaultValue={task.notes ?? ""}
            onBlur={(e) => {
              const v = e.target.value || null;
              if (v !== task.notes) updateField({ notes: v });
            }}
            rows={2}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Doc Link</span>
            <input
              type="url"
              defaultValue={task.doc_link ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== task.doc_link) updateField({ doc_link: v });
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Zoho Link</span>
            <input
              type="url"
              defaultValue={task.zoho_link ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== task.zoho_link) updateField({ zoho_link: v });
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Dependency</span>
          <input
            type="text"
            defaultValue={task.dependency ?? ""}
            onBlur={(e) => {
              const v = e.target.value.trim() || null;
              if (v !== task.dependency) updateField({ dependency: v });
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </label>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
          Budget
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Budgeted Cost</span>
            <input
              type="number"
              step="0.01"
              defaultValue={task.budgeted_cost ?? ""}
              onBlur={(e) => handleCostBlur("budgeted_cost", e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Actual Cost</span>
            <input
              type="number"
              step="0.01"
              defaultValue={task.actual_cost ?? ""}
              onBlur={(e) => handleCostBlur("actual_cost", e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Variance</span>
            <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white">
              {task.variance === null
                ? "—"
                : task.variance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide flex items-center gap-2">
            <Paperclip size={14} /> Evidence ({evidence.length})
          </h2>
          <label className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium cursor-pointer flex items-center gap-2 disabled:opacity-50">
            {uploading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Upload size={16} />
            )}
            Upload
            <input
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {evidence.length === 0 ? (
          <p className="text-sm text-slate-500">No evidence uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {evidence.map((e) => {
              const url = signedUrls[e.id];
              return (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 bg-slate-950/60 border border-slate-800 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {e.verified_by_manager ? (
                      <CheckCircle2
                        className="text-emerald-500 shrink-0"
                        size={18}
                      />
                    ) : (
                      <Clock className="text-amber-500 shrink-0" size={18} />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">
                        {e.file_url.split("/").pop()}
                      </p>
                      <p className="text-xs text-slate-500">
                        {e.uploaded_at
                          ? new Date(e.uploaded_at).toLocaleString()
                          : "—"}
                        {e.verified_by_manager
                          ? " • Verified"
                          : " • Pending verification"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 text-slate-400 hover:text-white"
                        title="Open"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                    {!e.verified_by_manager && canVerify && (
                      <button
                        onClick={() => verifyEvidence(e.id)}
                        disabled={verifyingId === e.id}
                        className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs rounded-lg border border-emerald-500/30 flex items-center gap-1 disabled:opacity-50"
                      >
                        {verifyingId === e.id ? (
                          <Loader2 className="animate-spin" size={12} />
                        ) : (
                          <CheckCircle2 size={12} />
                        )}
                        Verify
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteEvidence(e.id, e.file_url)}
                      className="p-2 text-red-400 hover:text-red-300"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showDateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Reschedule Task
              </h3>
              <button
                onClick={() => setShowDateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-400">
              Current due date:{" "}
              <span className="text-white">{task.due_date ?? "none"}</span>
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">New due date</span>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Reason</span>
              <textarea
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                rows={3}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </label>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDateModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={submitDateChange}
                disabled={savingDate}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
              >
                {savingDate ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Save size={16} />
                )}
                Save & Log
              </button>
            </div>
          </div>
        </div>
      )}

      {saving && (
        <div className="fixed bottom-4 right-4 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-400 flex items-center gap-2">
          <Loader2 className="animate-spin" size={12} /> Saving…
        </div>
      )}
    </div>
  );
}

export default function TaskWorkbookPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-12 flex justify-center text-slate-400">
          <Loader2 className="animate-spin text-blue-500" size={28} />
        </div>
      }
    >
      <TaskWorkbook params={params} />
    </Suspense>
  );
}