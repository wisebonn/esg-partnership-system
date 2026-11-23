"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, ArrowUpRight, CheckCircle2, Clock, Loader2, ShieldAlert, TrendingUp, Users,
} from "lucide-react";
import { createClient } from "@/app/utils/supabase";
import { SCORE_PERIODS, type ScorePeriod } from "@/app/utils/constants";
import {
  isDueSoon, isGreenwashing, isOverdue, pendingVerificationCount,
  periodPredicate, weightedScore, individualScore,
  type EvidenceLite, type ScoreResult, type TaskLite,
} from "@/app/utils/score";
import { useRealtimeSync } from "@/app/utils/useRealtime";
import { DonutChart, BarChart } from "@/app/components/Charts";
import KpiTracker from "@/app/components/KpiTracker";
import VerificationAlert from "@/app/components/VerificationAlert";

type Profile = { id: string; full_name: string | null; role: string | null; can_approve: boolean | null; };
type Snapshot = { id: string; period: string; scope: string; scope_id: string | null; score: number; captured_at: string; };
type Project = { id: string; status: string | null; };
type Partner = { id: string; category: string | null; };

export default function DashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [evidence, setEvidence] = useState<EvidenceLite[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [period, setPeriod] = useState<ScorePeriod>("YTD");
  const [meId, setMeId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      setMeId(auth?.user?.id ?? null);

      const [tasksRes, evRes, profRes, snapRes, projRes, partRes] = await Promise.all([
        supabase.from("tasks").select("id,title,status,weight,period,due_date,assigned_to,project_id,task_type,greenwash_overridden"),
        supabase.from("evidence").select("id,task_id,verified_by_manager"),
        supabase.from("profiles").select("id,full_name,role,can_approve"),
        supabase.from("score_snapshots").select("id,period,scope,scope_id,score,captured_at").eq("scope", "department").order("captured_at", { ascending: true }),
        supabase.from("projects").select("id, status"),
        supabase.from("partners").select("id, category"),
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (evRes.error) throw evRes.error;
      if (profRes.error) throw profRes.error;
      if (snapRes.error) throw snapRes.error;
      if (projRes.error) throw projRes.error;
      if (partRes.error) throw partRes.error;

      setTasks((tasksRes.data ?? []) as TaskLite[]);
      setEvidence((evRes.data ?? []) as EvidenceLite[]);
      setProfiles((profRes.data ?? []) as Profile[]);
      setSnapshots((snapRes.data ?? []) as Snapshot[]);
      setProjects((projRes.data ?? []) as Project[]);
      setPartners((partRes.data ?? []) as Partner[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useRealtimeSync();

  const evidenceByTaskId = useMemo(() => {
    const map: Record<string, EvidenceLite[]> = {};
    for (const e of evidence) {
      if (!map[e.task_id]) map[e.task_id] = [];
      map[e.task_id].push(e);
    }
    return map;
  }, [evidence]);

  const predicate = useMemo(() => periodPredicate(period), [period]);
  const deptScore: ScoreResult = useMemo(() => weightedScore(tasks, evidenceByTaskId, predicate), [tasks, evidenceByTaskId, predicate]);

  // AUTO-SNAPSHOT GENERATOR: Ensures the trend graph actually gets data
  useEffect(() => {
    async function saveSnapshot() {
      if (loading || deptScore.score === 0) return;
      
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const existing = snapshots.find(s => 
        s.period === period && 
        s.captured_at.startsWith(today)
      );

      if (!existing) {
        await supabase.from("score_snapshots").insert({
          period: period,
          scope: "department",
          score: deptScore.score,
          captured_at: new Date().toISOString()
        });
        // Silent refetch to update the graph
        const { data } = await supabase.from("score_snapshots").select("*").eq("scope", "department").order("captured_at", { ascending: true });
        if (data) setSnapshots(data as Snapshot[]);
      }
    }
    saveSnapshot();
  }, [deptScore.score, period, loading, snapshots, supabase]);


  const greenwashedTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!predicate(t)) return false;
      const ev = evidenceByTaskId[t.id] ?? [];
      const hasVerified = ev.some((x) => x.verified_by_manager === true);
      return isGreenwashing(t, hasVerified);
    });
  }, [tasks, evidenceByTaskId, predicate]);

  const overdueTasks = useMemo(() => tasks.filter((t) => predicate(t) && isOverdue(t)), [tasks, predicate]);
  const dueSoonTasks = useMemo(() => tasks.filter((t) => predicate(t) && isDueSoon(t)), [tasks, predicate]);
  const pendingCount = useMemo(() => pendingVerificationCount(tasks, evidenceByTaskId), [tasks, evidenceByTaskId]);

  const me = useMemo(() => profiles.find((p) => p.id === meId) ?? null, [profiles, meId]);
  const canVerify = !!me && (me.role === "manager" || me.can_approve === true);

  const staffCards = useMemo(() => profiles.map((p) => ({ profile: p, score: individualScore(tasks, evidenceByTaskId, p.id) })), [profiles, tasks, evidenceByTaskId]);

  const trendPoints = useMemo(() => {
    const filtered = snapshots.filter((s) => {
      if (period === "Q1" || period === "Q2" || period === "Q3" || period === "Q4") return s.period === period;
      return true;
    });
    return filtered.slice(-8);
  }, [snapshots, period]);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  }
  if (error) {
    return <div className="rounded-2xl border border-red-600/40 bg-red-600/10 p-6 text-red-300"><p className="font-semibold">Failed to load dashboard</p><p className="mt-1 text-sm text-red-200/80">{error}</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400">ESG &amp; Partnerships — live performance overview</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SCORE_PERIODS.map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${period === p ? "bg-blue-600 text-white" : "border border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700"}`}>{p}</button>
          ))}
        </div>
      </div>

      <VerificationAlert pendingCount={pendingCount} me={me} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm transition hover:-translate-y-1">
          <div className="flex items-center gap-2 text-slate-400"><Activity className="h-4 w-4" /><span className="text-xs uppercase tracking-wide">Department score</span></div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-5xl font-bold text-emerald-400">{deptScore.score.toFixed(1)}%</span>
            <span className="text-xs text-slate-500">{period}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(deptScore.score, 100)}%` }} /></div>
          <p className="mt-3 text-xs text-slate-400">{deptScore.verifiedCount}/{deptScore.taskCount} tasks verified · {deptScore.verifiedWeight}/{deptScore.totalWeight} weight</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm transition hover:-translate-y-1">
          <div className="flex items-center gap-2 text-slate-400"><TrendingUp className="h-4 w-4" /><span className="text-xs uppercase tracking-wide">Trend</span></div>
          {trendPoints.length === 0 ? <p className="mt-3 text-sm text-slate-500">No snapshots yet for {period}.</p> : <Sparkline points={trendPoints.map((s) => Number(s.score))} labels={trendPoints.map((s) => s.captured_at)} />}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm transition hover:-translate-y-1">
          <div className="flex items-center gap-2 text-slate-400"><ShieldAlert className="h-4 w-4" /><span className="text-xs uppercase tracking-wide">Greenwashing risk</span></div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-5xl font-bold ${deptScore.greenwashedCount > 0 ? "text-red-400" : "text-emerald-400"}`}>{deptScore.greenwashedCount}</span>
            <span className="text-xs text-slate-500">flagged</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">Marked &quot;Verified&quot; without manager-approved evidence. Excluded from score.</p>
          {greenwashedTasks.length > 0 && <ul className="mt-3 space-y-1">{greenwashedTasks.slice(0, 3).map((t) => <li key={t.id} className="truncate text-xs text-red-300">• {t.title}</li>)}</ul>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-400"><Clock className="h-4 w-4" /><span className="text-xs uppercase tracking-wide">Overdue</span></div>
            <div className="mt-2 text-5xl font-bold text-red-400">{overdueTasks.length}</div>
          </div>
          <ul className="mt-4 space-y-1">{overdueTasks.slice(0, 4).map((t) => <li key={t.id} className="truncate text-xs text-slate-300">• {t.title}</li>)}{overdueTasks.length === 0 && <li className="text-xs text-slate-500">Nothing overdue</li>}</ul>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-400"><Clock className="h-4 w-4" /><span className="text-xs uppercase tracking-wide">Due in 7 days</span></div>
            <div className="mt-2 text-5xl font-bold text-amber-400">{dueSoonTasks.length}</div>
          </div>
          <ul className="mt-4 space-y-1">{dueSoonTasks.slice(0, 4).map((t) => <li key={t.id} className="truncate text-xs text-slate-300">• {t.title}</li>)}{dueSoonTasks.length === 0 && <li className="text-xs text-slate-500">Clear ahead.</li>}</ul>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-400"><CheckCircle2 className="h-4 w-4" /><span className="text-xs uppercase tracking-wide">Awaiting verification</span></div>
            <div className={`mt-2 text-5xl font-bold ${pendingCount >= 5 ? "text-amber-400" : "text-slate-200"}`}>{pendingCount}</div>
          </div>
          <div className="mt-4">
            <p className="text-xs text-slate-400">{canVerify ? "You can verify in the Audit page." : "Manager verification required."}</p>
            <Link href="/dashboard/audit" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300">Open audit <ArrowUpRight className="h-3 w-3" /></Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm">
          <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Project Status Distribution</h3>
          <DonutChart data={[
            { label: "Completed", value: projects.filter(p => p.status === "Completed").length, color: "#10b981" },
            { label: "Execution", value: projects.filter(p => p.status === "Execution").length, color: "#3b82f6" },
            { label: "Planning", value: projects.filter(p => p.status === "Planning" || p.status === "Inception").length, color: "#f59e0b" },
          ]} />
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm">
          <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Partners by Category</h3>
          <BarChart data={[
            { label: "NGO", value: partners.filter(p => p.category === "Non-Governmental (NGO)").length },
            { label: "Corporate", value: partners.filter(p => p.category === "Corporate").length },
            { label: "Philanthropic", value: partners.filter(p => p.category === "Philanthropic").length },
            { label: "Governmental", value: partners.filter(p => p.category === "Governmental").length },
            { label: "Multilateral", value: partners.filter(p => p.category === "Humanitarian / Multilateral").length },
            { label: "Supplier", value: partners.filter(p => p.category === "Supplier").length },
          ]} />
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-slate-400" /><h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Individual scores — {period}</h2></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {staffCards.length === 0 && <p className="text-sm text-slate-500">No profiles found.</p>}
          {staffCards.map(({ profile, score }) => (
            <div key={profile.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-sm transition hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{profile.full_name ?? profile.id.slice(0, 8)}</p>
                  <p className="text-xs capitalize text-slate-500">{profile.role ?? "staff"}{profile.can_approve ? " · approver" : ""}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${score.score >= 80 ? "bg-emerald-500/15 text-emerald-300" : score.score >= 50 ? "bg-amber-500/15 text-amber-300" : "bg-red-500/15 text-red-300"}`}>{score.score.toFixed(1)}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full ${score.score >= 80 ? "bg-emerald-500" : score.score >= 50 ? "bg-amber-500" : "bg-red-600"}`} style={{ width: `${Math.min(score.score, 100)}%` }} /></div>
              <p className="mt-2 text-xs text-slate-400">{score.verifiedCount}/{score.taskCount} verified · {score.greenwashedCount} flagged</p>
            </div>
          ))}
        </div>
      </div>

      <KpiTracker />
    </div>
  );
}

// FIXED: Sparkline logic now handles single points and 0-100 scaling correctly
function Sparkline({ points, labels }: { points: number[]; labels: string[] }) {
  const width = 240; const height = 60; const pad = 6;
  
  // If only one point, draw a flat line in the middle
  if (points.length === 1) {
    return (
      <div className="mt-3">
         <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full" preserveAspectRatio="none">
            <line x1={pad} y1={height/2} x2={width-pad} y2={height/2} stroke="rgb(16 185 129)" strokeWidth="2" strokeLinecap="round" />
         </svg>
         <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>{labels[0]?.slice(0, 10) ?? ""}</span>
            <span>{labels[0]?.slice(0, 10) ?? ""}</span>
         </div>
      </div>
    )
  }

  const max = 100; const min = 0;
  const stepX = (width - pad * 2) / (points.length - 1);
  const path = points.map((v, i) => {
    const x = pad + i * stepX;
    const y = height - pad - ((Math.min(v, max) - min) / (max - min)) * (height - pad * 2);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full" preserveAspectRatio="none">
        <path d={path} fill="none" stroke="rgb(16 185 129)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{labels[0]?.slice(0, 10) ?? ""}</span>
        <span>{labels[labels.length - 1]?.slice(0, 10) ?? ""}</span>
      </div>
    </div>
  );
}