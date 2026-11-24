"use client";

import { useEffect, useMemo, useState } from "react";
import { 
  AlertTriangle, CheckCircle2, Clock, Download, Loader2, ShieldAlert, 
  ShieldCheck, XCircle, ExternalLink, X, Paperclip, MessageSquare, Search, User
} from "lucide-react";
import { createClient } from "@/app/utils/supabase";
import { SCORE_PERIODS, VERIFICATION_OVERFLOW_THRESHOLD, type ScorePeriod } from "@/app/utils/constants";
import { isGreenwashing, isOverdue, pendingVerificationCount, periodPredicate, weightedScore, type EvidenceLite, type TaskLite } from "@/app/utils/score";
import { downloadCsv, tasksToCsv } from "@/app/utils/excel";

type Profile = { id: string; full_name: string | null; role: string | null; can_approve: boolean | null; };
type AuditTask = TaskLite & { description: string | null; greenwash_overridden: boolean | null; };

type Row = AuditTask & { 
  evidenceCount: number; 
  hasVerified: boolean; 
  flag: "ok" | "pending" | "greenwash" | "overdue" | "verified"; 
  assignee_name: string;
};

type FullEvidence = { id: string; task_id: string; file_url: string; evidence_link: string | null; verified_by_manager: boolean; uploaded_at: string; };
type TaskComment = { id: string; task_id: string; user_id: string; content: string; created_at: string; };

export default function AuditPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<AuditTask[]>([]);
  const [evidence, setEvidence] = useState<EvidenceLite[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [period, setPeriod] = useState<ScorePeriod>("YTD");
  const [filter, setFilter] = useState<"all" | "pending" | "greenwash" | "overdue" | "verified">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Task Detail Modal State
  const [selectedTask, setSelectedTask] = useState<Row | null>(null);
  const [taskEvidence, setTaskEvidence] = useState<FullEvidence[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);

  // Reject Modal State
  const [rejectTaskId, setRejectTaskId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id ?? null;

        const [tasksRes, evRes, profRes] = await Promise.all([
          supabase.from("tasks").select("id,title,description,status,weight,period,due_date,assigned_to,project_id,task_type,greenwash_overridden"),
          supabase.from("evidence").select("id,task_id,verified_by_manager"),
          supabase.from("profiles").select("id,full_name,role,can_approve")
        ]);

        if (tasksRes.error) throw tasksRes.error;
        if (evRes.error) throw evRes.error;
        if (profRes.error) throw profRes.error;

        if (!cancelled) {
          setTasks((tasksRes.data ?? []) as AuditTask[]);
          setEvidence((evRes.data ?? []) as EvidenceLite[]);
          setProfiles((profRes.data ?? []) as Profile[]);
          setMe((profRes.data ?? []).find((p: any) => p.id === uid) ?? null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load audit.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  const evidenceByTaskId = useMemo(() => {
    const map: Record<string, EvidenceLite[]> = {};
    for (const e of evidence) {
      if (!map[e.task_id]) map[e.task_id] = [];
      map[e.task_id].push(e);
    }
    return map;
  }, [evidence]);

  const predicate = useMemo(() => periodPredicate(period), [period]);
  const canVerify = !!me && (me.role === "manager" || me.can_approve === true);

  const rows: Row[] = useMemo(() => {
    return tasks.filter((t) => predicate(t)).map((t) => {
      const ev = evidenceByTaskId[t.id] ?? [];
      const hasVerified = ev.some((e) => e.verified_by_manager === true);
      
      let flag: Row["flag"] = "ok";
      if (t.status === "Verified" && hasVerified) flag = "verified";
      else if (isGreenwashing(t, hasVerified) && !t.greenwash_overridden) flag = "greenwash";
      else if (t.status === "Pending Evidence" && !hasVerified) flag = "pending";
      else if (isOverdue(t)) flag = "overdue";

      const profile = profiles.find(p => p.id === t.assigned_to);
      
      return { 
        ...t, 
        evidenceCount: ev.length, 
        hasVerified, 
        flag,
        assignee_name: profile?.full_name || "Unassigned"
      };
    });
  }, [tasks, evidenceByTaskId, predicate, profiles]);

  // FIXED: Filter logic now correctly stacks the status filters and the search query
  const filteredRows = useMemo(() => {
    let result = rows;
    
    // 1. Apply the status filter tabs first
    if (filter === "pending") result = result.filter((r) => r.flag === "pending");
    else if (filter === "greenwash") result = result.filter((r) => r.flag === "greenwash");
    else if (filter === "overdue") result = result.filter((r) => r.flag === "overdue");
    else if (filter === "verified") result = result.filter((r) => r.flag === "verified");
    // "all" shows everything
    
    // 2. Apply the search query on top of the filtered results
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.title.toLowerCase().includes(q) || 
        r.assignee_name.toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [rows, filter, searchQuery]);

  const score = useMemo(() => weightedScore(tasks, evidenceByTaskId, predicate), [tasks, evidenceByTaskId, predicate]);
  const pendingCount = useMemo(() => pendingVerificationCount(tasks, evidenceByTaskId), [tasks, evidenceByTaskId]);
  const overflow = pendingCount > VERIFICATION_OVERFLOW_THRESHOLD;

  async function refetch() {
    const { data: evRefetch } = await supabase.from("evidence").select("id,task_id,verified_by_manager");
    const { data: tRefetch } = await supabase.from("tasks").select("id,title,description,status,weight,period,due_date,assigned_to,project_id,task_type,greenwash_overridden");
    setEvidence((evRefetch ?? []) as EvidenceLite[]);
    setTasks((tRefetch ?? []) as AuditTask[]);
  }

  const handleOpenTask = async (task: Row) => {
    setSelectedTask(task);
    setLoadingEvidence(true);
    const [evRes, comRes] = await Promise.all([
      supabase.from("evidence").select("*").eq("task_id", task.id),
      supabase.from("task_comments").select("*").eq("task_id", task.id).order("created_at", { ascending: true })
    ]);
    if (evRes.error) setActionError(evRes.error.message); else setTaskEvidence(evRes.data as FullEvidence[]);
    if (comRes.error) setActionError(comRes.error.message); else setTaskComments(comRes.data as TaskComment[]);
    setLoadingEvidence(false);
  };

  async function handleApprove(taskId: string) {
    if (!canVerify) return;
    setBusyId(taskId); setActionError(null);
    try {
      const unverified = taskEvidence.find(e => e.verified_by_manager !== true);
      if (unverified) {
        const { error: evError } = await supabase.from("evidence").update({ verified_by_manager: true }).eq("id", unverified.id);
        if (evError) throw new Error("Evidence update failed: " + evError.message);
      }
      
      const { error: taskError } = await supabase.from("tasks").update({ status: "Verified" }).eq("id", taskId);
      if (taskError) throw new Error("Task update failed: " + taskError.message);

      setSelectedTask(null); setTaskEvidence([]); await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Verification failed.");
    } finally { setBusyId(null); }
  }

  async function handleOverrideGreenwash(taskId: string) {
    if (!canVerify) return;
    if (!confirm("Are you sure you want to override the greenwash flag? This will mark the task as Verified without system evidence.")) return;
    setBusyId(taskId); setActionError(null);
    try {
      const { error } = await supabase.from("tasks").update({ status: "Verified", greenwash_overridden: true }).eq("id", taskId);
      if (error) throw error;
      setSelectedTask(null); await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Override failed.");
    } finally { setBusyId(null); }
  }

  const handleRejectSubmit = async () => {
    if (!rejectTaskId || !canVerify || !rejectComment.trim()) return;
    setRejecting(true); setActionError(null);
    try {
      const { error: taskErr } = await supabase.from("tasks").update({ status: "In Progress" }).eq("id", rejectTaskId);
      if (taskErr) throw taskErr;

      const { error: comErr } = await supabase.from("task_comments").insert({
        task_id: rejectTaskId, user_id: me?.id, content: rejectComment.trim()
      });
      if (comErr) throw comErr;

      setRejectTaskId(null); setRejectComment(""); setSelectedTask(null); await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Reject failed.");
    } finally {
      setRejecting(false);
    }
  };

  function handleExport() {
    const csv = tasksToCsv(filteredRows.map((r) => ({
      title: r.title, description: null, status: r.status ?? null, period: r.period ?? null, weight: r.weight ?? null, due_date: r.due_date ?? null, assigned_to: r.assignee_name ?? null, project_id: r.project_id ?? null, task_type: r.task_type ?? null, phase: null, notes: null, doc_link: null, budgeted_cost: null, actual_cost: null, variance: null, recurring: null, zoho_link: null,
    })));
    downloadCsv(`epas-audit-${period.toLowerCase()}.csv`, csv);
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  if (error) return <div className="rounded-2xl border border-red-600/40 bg-red-600/10 p-6 text-red-300"><p className="font-semibold">Failed to load audit</p><p className="mt-1 text-sm text-red-200/80">{error}</p></div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-semibold text-white">Audit &amp; Verification</h1><p className="text-sm text-slate-400">Verify evidence, manage greenwashing, and enforce quality.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">{SCORE_PERIODS.map((p) => <button key={p} onClick={() => setPeriod(p)} className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${period === p ? "bg-blue-600 text-white" : "border border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700"}`}>{p}</button>)}</div>
          <button onClick={handleExport} className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-700"><Download className="h-3.5 w-3.5" /> Export CSV</button>
        </div>
      </div>

      {!canVerify && <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-300"><ShieldAlert className="mr-2 inline h-4 w-4 text-amber-400" /> You are viewing in read-only mode. Verification actions require manager rights or delegated approval.</div>}

      {overflow && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
          <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" /><div><p className="font-semibold text-amber-200">{pendingCount} tasks await verification.</p><p className="mt-1 text-sm text-amber-200/80">Threshold is {VERIFICATION_OVERFLOW_THRESHOLD}. Clear the backlog.</p></div></div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Dept score" value={`${score.score.toFixed(1)}%`} tone="emerald" />
        <Stat label="Pending" value={pendingCount.toString()} tone={overflow ? "amber" : "slate"} />
        <Stat label="Greenwashed" value={score.greenwashedCount.toString()} tone={score.greenwashedCount > 0 ? "red" : "slate"} />
        <Stat label="Verified" value={`${score.verifiedCount}/${score.taskCount}`} tone="slate" />
      </div>

      {/* FILTERS & SEARCH */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap gap-2">
          {(["all", "pending", "greenwash", "overdue", "verified"] as const).map((key) => (
            <button key={key} onClick={() => setFilter(key)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${filter === key ? "bg-blue-600 text-white" : "bg-slate-950 text-slate-400 hover:text-white"}`}>
              {key === "all" ? "All Tasks" : key === "pending" ? "Pending Approval" : key === "greenwash" ? "Greenwashed" : key === "overdue" ? "Overdue" : "Verified"}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search task or assignee..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {actionError && <div className="rounded-2xl border border-red-600/40 bg-red-600/10 p-3 text-sm text-red-300">{actionError}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Timeline</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Flag</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredRows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No tasks match this filter.</td></tr>}
              {filteredRows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-950/40 cursor-pointer transition-colors" onClick={() => handleOpenTask(r)}>
                  <td className="max-w-[250px] px-4 py-3">
                    <p className="truncate font-medium text-slate-100">{r.title}</p>
                    <p className="text-[11px] text-slate-500">W{r.weight ?? 1} · {r.task_type ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300">
                        {r.assignee_name.charAt(0)}
                      </div>
                      <span className="text-slate-300">{r.assignee_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    <p>{r.period ?? "N/A"}</p>
                    {r.due_date && <p className="text-[10px]">Due: {new Date(r.due_date).toLocaleDateString()}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200">{r.status ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3"><Flag flag={r.flag} /></td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleOpenTask(r)} className="text-xs font-semibold text-blue-400 hover:text-blue-300 px-2 py-1">Review</button>
                      {r.flag === "greenwash" && canVerify && (
                        <button onClick={() => handleOverrideGreenwash(r.id)} className="text-xs font-semibold text-amber-400 hover:text-amber-300 px-2 py-1">Override</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* TASK DETAIL MODAL */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-start p-6 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Flag flag={selectedTask.flag} />
                  <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">{selectedTask.period}</span>
                </div>
                <h2 className="text-xl font-semibold text-white">{selectedTask.title}</h2>
                <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                  <User size={14} /> {selectedTask.assignee_name} · Weight {selectedTask.weight}
                </p>
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-white p-2 bg-slate-800 rounded-lg"><X size={20} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div>
                <h3 className="text-sm font-semibold text-slate-300 border-b border-slate-800 pb-2 mb-3">Task Description</h3>
                <p className="text-sm text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  {selectedTask.description || "No description provided."}
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300 border-b border-slate-800 pb-2">Submitted Evidence</h3>
                {loadingEvidence ? <Loader2 className="animate-spin text-blue-500" /> : taskEvidence.length === 0 ? <p className="text-slate-500 text-sm italic">No evidence attached yet.</p> : taskEvidence.map((ev) => (
                  <div key={ev.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-slate-400">Uploaded {ev.uploaded_at ? new Date(ev.uploaded_at).toLocaleDateString() : "N/A"}</p>
                      {ev.verified_by_manager && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Verified</span>}
                    </div>
                    {ev.evidence_link && <a href={ev.evidence_link} target="_blank" className="text-sm text-blue-400 hover:underline flex items-center gap-1"><ExternalLink size={14}/> Open Link</a>}
                    {ev.file_url && <a href={ev.file_url} target="_blank" className="text-sm text-blue-400 hover:underline flex items-center gap-1"><Paperclip size={14}/> Open File</a>}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300 border-b border-slate-800 pb-2">Staff Comments</h3>
                {taskComments.length === 0 ? <p className="text-slate-500 text-sm italic">No comments left.</p> : taskComments.map(c => (
                  <div key={c.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300"><MessageSquare size={14} className="inline mr-2 text-slate-500" />{c.content}</div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-between items-center bg-slate-950/50 rounded-b-2xl">
              <button onClick={() => setSelectedTask(null)} className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg">Close</button>
              
              {canVerify && selectedTask.flag !== "verified" && (
                <div className="flex gap-3">
                  {selectedTask.flag === "pending" && (
                    <button onClick={() => setRejectTaskId(selectedTask.id)} className="px-4 py-2 border border-red-600/60 text-red-300 text-sm rounded-lg hover:bg-red-600/10 flex items-center gap-2"><XCircle size={16} /> Reject</button>
                  )}
                  <button onClick={() => handleApprove(selectedTask.id)} disabled={busyId === selectedTask.id} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg flex items-center gap-2">
                    {busyId === selectedTask.id ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />} Approve & Verify
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {rejectTaskId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-800"><h2 className="text-lg font-semibold text-white">Reject Evidence</h2><button onClick={() => setRejectTaskId(null)} className="text-slate-400 hover:text-white"><X size={20} /></button></div>
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">Reason for Rejection (Visible to Staff)</label>
              <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} rows={4} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none" placeholder="e.g. The photo does not show the installation clearly. Please re-upload..." />
            </div>
            <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
              <button onClick={() => setRejectTaskId(null)} className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg">Cancel</button>
              <button onClick={handleRejectSubmit} disabled={rejecting || !rejectComment.trim()} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg flex items-center gap-2">{rejecting ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />} Submit Rejection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "red" | "slate"; }) {
  const toneClass = tone === "emerald" ? "text-emerald-400" : tone === "amber" ? "text-amber-400" : tone === "red" ? "text-red-400" : "text-slate-200";
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-sm"><p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</p></div>;
}

function Flag({ flag }: { flag: Row["flag"] }) {
  if (flag === "greenwash") return <span className="inline-flex items-center gap-1 rounded-full bg-red-600/15 px-2 py-0.5 text-[11px] text-red-300"><ShieldAlert className="h-3 w-3" /> Greenwash</span>;
  if (flag === "pending") return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300"><Clock className="h-3 w-3" /> Pending</span>;
  if (flag === "overdue") return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300"><Clock className="h-3 w-3" /> Overdue</span>;
  if (flag === "verified") return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Verified</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">OK</span>;
}