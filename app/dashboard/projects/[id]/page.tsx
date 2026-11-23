"use client";

import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/app/utils/supabase";
import { 
  ChevronLeft, Loader2, Calendar, CheckCircle2, DollarSign, Briefcase, 
  TrendingUp, Edit, Trash2, X, Save, FileText, Printer, Plus, AlertTriangle, Link as LinkIcon
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type Project = {
  id: string; name: string; project_type: string; status: string; start_date: string; target_end_date: string;
  interventions: string[]; tie_to_plan: boolean; period: string | null; partner?: { name: string } | null;
};
type Site = { id: string; name: string; location: string; approved_quote: number; actual_spend: number; c_cost: number; partner_revenue: number; };
type Task = { id: string; title: string; status: string; phase?: string | null; weight: number; period: string | null; assigned_to?: string | null; };
type Profile = { id: string; full_name: string | null };

const PHASES = ["Assessment", "Procurement", "Installation", "Commissioning", "Reconciliation"];
const formCls = "w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-blue-500";
const labelCls = "text-xs text-slate-400 mb-1 block";

export default function ProjectDetailsPage() {
  return (
    <Suspense fallback={<div className="p-12 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>}>
      <ProjectDetailsContent />
    </Suspense>
  );
}

function ProjectDetailsContent() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  // Modals
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [editProjectForm, setEditProjectForm] = useState<Partial<Project>>({});
  
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Partial<Site> | null>(null);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);

  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    const { data: proj } = await supabase.from("projects").select(`*, partner:partners(name)`).eq("id", id).single();
    if (proj) { setProject(proj as unknown as Project); setEditProjectForm(proj); }

    const { data: sData } = await supabase.from("project_sites").select("*").eq("project_id", id);
    if (sData) setSites(sData as Site[]);

    const { data: tData } = await supabase.from("tasks").select("id, title, status, phase, weight, period, assigned_to").eq("project_id", id).order("created_at", { ascending: true });
    if (tData) setTasks(tData as Task[]);

    const { data: pData } = await supabase.from("profiles").select("id, full_name");
    if (pData) setProfiles(pData);

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

  // --- ACTIONS ---
  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await supabase.from("projects").update({ name: editProjectForm.name, start_date: editProjectForm.start_date, target_end_date: editProjectForm.target_end_date }).eq("id", id);
    setIsEditProjectOpen(false); fetchData(); setSaving(false);
  };

  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingSite) return; setSaving(true);
    
    const payload = {
      project_id: id,
      name: editingSite.name || "Unnamed Site",
      location: editingSite.location || null,
      approved_quote: Number(editingSite.approved_quote) || 0,
      actual_spend: Number(editingSite.actual_spend) || 0,
      c_cost: Number(editingSite.c_cost) || 0,
      partner_revenue: Number(editingSite.partner_revenue) || 0,
    };

    if (editingSite.id) {
      await supabase.from("project_sites").update(payload).eq("id", editingSite.id);
    } else {
      await supabase.from("project_sites").insert(payload);
    }
    setIsSiteModalOpen(false); setEditingSite(null); fetchData(); setSaving(false);
  };

  const handleDeleteSite = async (siteId: string) => {
    if (!confirm("Delete this site?")) return;
    await supabase.from("project_sites").delete().eq("id", siteId);
    fetchData();
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingTask) return; setSaving(true);
    
    const payload = {
      project_id: id,
      task_type: "project",
      title: editingTask.title || "Untitled Task",
      phase: editingTask.phase || "Assessment",
      weight: editingTask.weight || 2,
      status: editingTask.status || "To Do",
      assigned_to: editingTask.assigned_to || null,
      // Inherit plan period if tied
      period: project?.tie_to_plan ? project.period : null 
    };

    if (editingTask.id) {
      await supabase.from("tasks").update(payload).eq("id", editingTask.id);
    } else {
      await supabase.from("tasks").insert(payload);
    }
    setIsTaskModalOpen(false); setEditingTask(null); fetchData(); setSaving(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    await supabase.from("tasks").delete().eq("id", taskId);
    fetchData();
  };

  // --- BLUF REPORT GENERATOR ---
  const generateReport = () => {
    if (!project) return;
    
    const totalBudget = sites.reduce((sum, s) => sum + Number(s.approved_quote || 0), 0);
    const totalCost = sites.reduce((sum, s) => sum + Number(s.actual_spend || 0), 0);
    const totalRevenue = sites.reduce((sum, s) => sum + Number(s.partner_revenue || 0), 0);
    const totalCCost = sites.reduce((sum, s) => sum + Number(s.c_cost || 0), 0);
    
    const completedTasks = tasks.filter(t => t.status === "Verified").length;
    const totalTasks = tasks.length;
    const scopePercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    const budgetPercent = totalBudget > 0 ? Math.round((totalCost / totalBudget) * 100) : 0;
    const isOverBudget = totalCost > totalBudget;
    
    // RAG Logic
    const scopeRag = scopePercent === 100 ? "green" : scopePercent >= 50 ? "amber" : "red";
    const budgetRag = isOverBudget ? "red" : budgetPercent >= 90 ? "amber" : "green";
    const isPastDue = project.target_end_date && new Date(project.target_end_date) < new Date();
    const scheduleRag = isPastDue && scopePercent < 100 ? "red" : scopePercent >= 90 ? "green" : "amber";

    const blockedTasks = tasks.filter(t => t.status === "Blocked");
    const accomplishments = tasks.filter(t => t.status === "Verified").slice(0, 5);
    const nextSteps = tasks.filter(t => t.status !== "Verified").slice(0, 5);

    let reportHtml = `
      <html>
      <head>
        <title>Executive Report - ${project.name}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1f2937; line-height: 1.5; max-width: 900px; margin: 0 auto; }
          h1 { color: #111827; border-bottom: 3px solid #2563eb; padding-bottom: 10px; margin-bottom: 5px; }
          .subtitle { color: #6b7280; font-size: 0.9em; margin-bottom: 30px; }
          h2 { color: #1e3a8a; margin-top: 30px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; font-size: 1.2em; text-transform: uppercase; letter-spacing: 0.05em; }
          ul { margin-top: 10px; padding-left: 20px; }
          li { margin-bottom: 8px; }
          .rag-container { display: flex; gap: 20px; margin: 20px 0; }
          .rag-box { flex: 1; padding: 15px; border-radius: 8px; text-align: center; font-weight: bold; color: white; }
          .rag-green { background-color: #10b981; }
          .rag-amber { background-color: #f59e0b; }
          .rag-red { background-color: #ef4444; }
          .metrics-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .metrics-table th, .metrics-table td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          .metrics-table th { background-color: #f9fafb; color: #374151; font-weight: 600; }
          .raid-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin-top: 15px; border-radius: 4px; }
          .raid-box h3 { color: #991b1b; margin: 0 0 10px 0; font-size: 1em; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold; }
          .bg-red { background: #fee2e2; color: #991b1b; }
          .bg-green { background: #d1fae5; color: #065f46; }
        </style>
      </head>
      <body>
        <h1>${project.name}</h1>
        <div class="subtitle">
          <strong>Partner:</strong> ${project.partner?.name || "Internal"} | 
          <strong>Timeline:</strong> ${project.start_date || "N/A"} to ${project.target_end_date || "N/A"} |
          <strong>Report Date:</strong> ${new Date().toLocaleDateString()}
        </div>

        <h2>1. Executive Summary (BLUF)</h2>
        <ul>
          <li><strong>Overall Health:</strong> The project is currently <strong>${scopePercent}% complete</strong> and is <strong>${budgetRag === "red" ? "OVER BUDGET" : "WITHIN BUDGET"}</strong>.</li>
          <li><strong>Key Wins:</strong> Successfully completed ${completedTasks} tasks including ${accomplishments.length > 0 ? accomplishments[0].title : "initial milestones"}.</li>
          <li><strong>Roadblocks:</strong> ${blockedTasks.length > 0 ? `<strong>${blockedTasks.length} tasks are currently blocked.</strong> Immediate attention required.` : "No critical blockers at this time."}</li>
        </ul>

        <h2>2. RAG Status Dashboard</h2>
        <div class="rag-container">
          <div class="rag-box rag-${scheduleRag}">Schedule</div>
          <div class="rag-box rag-${budgetRag}">Budget</div>
          <div class="rag-box rag-${scopeRag}">Scope</div>
        </div>

        <h2>3. Key Metrics & Variance</h2>
        <table class="metrics-table">
          <thead>
            <tr><th>Metric</th><th>Target / Baseline</th><th>Actual</th><th>Variance</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Tasks Completed</td>
              <td>${totalTasks} Tasks</td>
              <td>${completedTasks} Tasks</td>
              <td><strong>${scopePercent}%</strong></td>
            </tr>
            <tr>
              <td>Approved Budget</td>
              <td>KES ${totalBudget.toLocaleString()}</td>
              <td>KES ${totalCost.toLocaleString()}</td>
              <td style="color: ${isOverBudget ? '#ef4444' : '#10b981'}; font-weight: bold;">
                ${isOverBudget ? '-' : '+'} KES ${Math.abs(totalBudget - totalCost).toLocaleString()}
              </td>
            </tr>
            <tr>
              <td>Partner Revenue</td>
              <td>--</td>
              <td>KES ${totalRevenue.toLocaleString()}</td>
              <td><strong>KES ${(totalRevenue - totalCCost).toLocaleString()} (Profit)</strong></td>
            </tr>
          </tbody>
        </table>

        <h2>4. Accomplishments vs Next Steps</h2>
        <div style="display: flex; gap: 30px;">
          <div style="flex: 1;">
            <h3 style="font-size: 1em; color: #065f46; margin-bottom: 10px;">Accomplishments</h3>
            <ul>${accomplishments.map(t => `<li><span class="badge bg-green">Done</span> ${t.title}</li>`).join('') || '<li>No tasks completed yet.</li>'}</ul>
          </div>
          <div style="flex: 1;">
            <h3 style="font-size: 1em; color: #1e3a8a; margin-bottom: 10px;">Next Steps</h3>
            <ul>${nextSteps.map(t => `<li><span class="badge bg-red" style="background:#e5e7eb; color:#374151;">Pending</span> ${t.title}</li>`).join('') || '<li>All tasks completed!</li>'}</ul>
          </div>
        </div>

        <h2>5. Risks, Issues & Blockers</h2>
        ${blockedTasks.length > 0 ? `
          <div class="raid-box">
            <h3>⚠️ Active Blockers</h3>
            <ul>${blockedTasks.map(t => `<li><strong>${t.title}</strong></li>`).join('')}</ul>
          </div>
        ` : '<p style="color: #10b981; font-weight: bold;">✅ No current risks or blockers. Project is on track.</p>'}
      </body>
      </html>
    `;

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(reportHtml);
      newWindow.document.close();
      setTimeout(() => newWindow.print(), 500);
    }
  };

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;
  if (!project) return <div className="p-12 text-center text-red-400">Project not found.</div>;

  // --- FINANCIALS ---
  const totalBudget = sites.reduce((sum, s) => sum + Number(s.approved_quote || 0), 0);
  const totalCost = sites.reduce((sum, s) => sum + Number(s.actual_spend || 0), 0);
  const totalCCost = sites.reduce((sum, s) => sum + Number(s.c_cost || 0), 0);
  const totalRevenue = sites.reduce((sum, s) => sum + Number(s.partner_revenue || 0), 0);
  
  const variance = totalBudget - totalCost;
  const profit = totalRevenue - totalCCost;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  // --- RECONCILIATION LOCK LOGIC ---
  // A site must have an actual_spend greater than 0 to be considered "costed"
  const allSitesHaveCost = sites.length > 0 && sites.every(s => Number(s.actual_spend) > 0);

  const phaseProgress = PHASES.map(phase => {
    const phaseTasks = tasks.filter(t => t.phase === phase);
    let completed = phaseTasks.filter(t => t.status === "Verified").length;
    let total = phaseTasks.length;
    
    let isLocked = false;
    if (phase === "Reconciliation" && !allSitesHaveCost) {
      isLocked = true;
      // Visually force the bar to not show 100% if sites aren't reconciled
      if (completed === total && total > 0) completed = total - 1; 
    }

    return { name: phase, tasks: phaseTasks, total, completed, percent: total > 0 ? (completed / total) * 100 : 0, isLocked };
  });

  return (
    <div className="space-y-6 pb-10 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <Link href="/dashboard/projects" className="text-sm text-slate-400 hover:text-white flex items-center gap-1">
          <ChevronLeft size={16} /> Back to Projects
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowReport(true)} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
            <FileText size={14} /> Generate Report
          </button>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400 border border-blue-800/50">{project.status}</span>
            {project.tie_to_plan && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Tied to Plan: {project.period}</span>}
            <button onClick={() => setIsEditProjectOpen(true)} className="text-slate-400 hover:text-white ml-2"><Edit size={16} /></button>
          </div>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-3">
            <span className="flex items-center gap-1"><Briefcase size={14}/> {project.partner?.name || "Internal Project"}</span>
            <span className="flex items-center gap-1"><Calendar size={14}/> {project.start_date || "TBD"} to {project.target_end_date || "TBD"}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
           {project.interventions?.map(int => <span key={int} className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-md">{int}</span>)}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Approved Budget</p>
          <p className="text-2xl font-bold text-slate-200">KES {totalBudget.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Actual Cost</p>
          <p className="text-2xl font-bold text-slate-200">KES {totalCost.toLocaleString()}</p>
        </div>
        <div className={`border rounded-xl p-5 ${variance >= 0 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"}`}>
          <p className="text-xs uppercase tracking-wide mb-1 opacity-70 flex items-center gap-1"><TrendingUp size={14}/> Variance</p>
          <p className={`text-2xl font-bold ${variance >= 0 ? "text-emerald-400" : "text-red-400"}`}>KES {variance.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10"><DollarSign size={48}/></div>
          <p className="text-xs text-blue-400 uppercase tracking-wide mb-1 font-semibold">Partner Revenue</p>
          <p className="text-2xl font-bold text-white">KES {totalRevenue.toLocaleString()}</p>
          <p className={`text-xs mt-1 font-medium ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>Profit: KES {profit.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white mb-6 uppercase tracking-wide">Project Lifecycle</h2>
        <div className="flex flex-col md:flex-row gap-2">
          {phaseProgress.map((p, idx) => (
            <div key={idx} className={`flex-1 p-3 rounded-lg border ${p.isLocked ? "bg-red-500/10 border-red-500/30" : p.percent === 100 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-slate-950 border-slate-800"}`}>
              <div className="flex justify-between items-center mb-2">
                <span className={`text-xs font-semibold ${p.isLocked ? "text-red-400" : p.percent === 100 ? "text-emerald-400" : "text-slate-300"}`}>{p.name}</span>
                {p.isLocked ? <AlertTriangle size={14} className="text-red-400" /> : p.percent === 100 && <CheckCircle2 size={14} className="text-emerald-400" />}
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${p.isLocked ? "bg-red-500" : p.percent === 100 ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${p.percent}%` }} />
              </div>
              <p className="text-[10px] text-slate-500 mt-2">{p.completed} / {p.total} tasks</p>
              {p.isLocked && <p className="text-[9px] text-red-400 mt-1">Enter site costs to reconcile</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Tasks Column */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Project Tasks</h2>
            <button onClick={() => { setEditingTask({ phase: "Assessment" }); setIsTaskModalOpen(true); }} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><Plus size={12}/> Add Task</button>
          </div>
          <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
            {phaseProgress.map(phase => (
              phase.tasks.length > 0 && (
                <div key={phase.name}>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 border-b border-slate-800 pb-1">{phase.name}</h3>
                  <div className="space-y-2">
                    {phase.tasks.map((t, index) => (
                      <div key={t.id} className="flex flex-col gap-2 p-3 bg-slate-950 border border-slate-800 rounded-lg hover:border-blue-500/30 transition-colors group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 text-xs flex items-center justify-center font-bold">{index + 1}</span>
                            <span className="text-sm text-slate-200">{t.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-1 rounded-full ${t.status === "Verified" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"}`}>{t.status}</span>
                            <button onClick={() => { setEditingTask(t); setIsTaskModalOpen(true); }} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-blue-400"><Edit size={12}/></button>
                            <button onClick={() => handleDeleteTask(t.id)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400"><Trash2 size={12}/></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>

        {/* Site Financials Column */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Site Breakdown</h2>
            <button onClick={() => { setEditingSite({}); setIsSiteModalOpen(true); }} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><Plus size={12}/> Add Site</button>
          </div>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {sites.length === 0 && <p className="text-sm text-slate-500">No sites added.</p>}
            {sites.map(s => {
              const siteVar = Number(s.approved_quote) - Number(s.actual_spend);
              const siteProfit = Number(s.partner_revenue) - Number(s.c_cost);
              return (
                <div key={s.id} className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-white">{s.name}</span>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingSite(s); setIsSiteModalOpen(true); }} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 px-2 py-1 rounded"><Edit size={12} /> Edit</button>
                      <button onClick={() => handleDeleteSite(s.id)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded"><Trash2 size={12} /> Delete</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-2 text-xs">
                    <div><span className="block text-[10px] text-slate-500">Approved</span> {Number(s.approved_quote).toLocaleString()}</div>
                    <div><span className="block text-[10px] text-slate-500">Actual</span> {Number(s.actual_spend).toLocaleString()}</div>
                    <div><span className="block text-[10px] text-slate-500">C-Cost</span> {Number(s.c_cost).toLocaleString()}</div>
                    <div><span className="block text-[10px] text-slate-500">Revenue</span> {Number(s.partner_revenue).toLocaleString()}</div>
                    <div>
                      <span className="block text-[10px] text-slate-500">Variance</span> 
                      <span className={siteVar >= 0 ? "text-emerald-400" : "text-red-400"}>{siteVar.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-right text-blue-400 font-medium">
                    Site Profit: {siteProfit.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* Generate Report Modal */}
      {showReport && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl p-6 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2"><FileText size={20} className="text-blue-500"/> Executive BLUF Report</h2>
              <button onClick={() => setShowReport(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 text-sm text-slate-300 pr-2">
              <p>This will generate a professional, executive-ready report using the <strong>BLUF (Bottom Line Up Front)</strong> methodology. It includes RAG status, Planned vs Actual variance, and a RAID log.</p>
            </div>
            <div className="pt-4 border-t border-slate-800 mt-4 flex justify-end gap-3">
              <button onClick={() => setShowReport(false)} className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium">Cancel</button>
              <button onClick={generateReport} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-2">
                <Printer size={16}/> Generate & Print Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {isTaskModalOpen && editingTask && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">{editingTask.id ? "Edit Task" : "Add Task"}</h2>
            <form onSubmit={handleSaveTask} className="space-y-4">
              <div><label className={labelCls}>Title</label><input required value={editingTask.title || ""} onChange={e => setEditingTask({...editingTask, title: e.target.value})} className={formCls} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Phase</label>
                  <select value={editingTask.phase || "Assessment"} onChange={e => setEditingTask({...editingTask, phase: e.target.value})} className={formCls}>
                    {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Status</label>
                  <select value={editingTask.status || "To Do"} onChange={e => setEditingTask({...editingTask, status: e.target.value})} className={formCls}>
                    {["To Do", "In Progress", "Blocked", "Pending Evidence", "Verified"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div><label className={labelCls}>Assignee</label>
                <select value={editingTask.assigned_to || ""} onChange={e => setEditingTask({...editingTask, assigned_to: e.target.value})} className={formCls}>
                  <option value="">Unassigned</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="flex-1 py-2.5 bg-slate-800 text-white rounded-lg font-medium">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium">{saving ? <Loader2 className="animate-spin" size={18} /> : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Site Modal */}
      {isSiteModalOpen && editingSite && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">{editingSite.id ? "Edit Site" : "Add Site"}</h2>
            <form onSubmit={handleSaveSite} className="space-y-4">
              <div><label className={labelCls}>Site Name</label><input required value={editingSite.name || ""} onChange={e => setEditingSite({...editingSite, name: e.target.value})} className={formCls} /></div>
              <div><label className={labelCls}>Location</label><input value={editingSite.location || ""} onChange={e => setEditingSite({...editingSite, location: e.target.value})} className={formCls} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Approved Budget</label><input type="number" value={editingSite.approved_quote || 0} onChange={e => setEditingSite({...editingSite, approved_quote: Number(e.target.value)})} className={formCls} /></div>
                <div><label className={labelCls}>Actual Cost</label><input type="number" value={editingSite.actual_spend || 0} onChange={e => setEditingSite({...editingSite, actual_spend: Number(e.target.value)})} className={formCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>C-Cost (Internal)</label><input type="number" value={editingSite.c_cost || 0} onChange={e => setEditingSite({...editingSite, c_cost: Number(e.target.value)})} className={formCls} /></div>
                <div><label className={labelCls}>Partner Revenue</label><input type="number" value={editingSite.partner_revenue || 0} onChange={e => setEditingSite({...editingSite, partner_revenue: Number(e.target.value)})} className={formCls} /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsSiteModalOpen(false)} className="flex-1 py-2.5 bg-slate-800 text-white rounded-lg font-medium">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg font-medium">{saving ? <Loader2 className="animate-spin" size={18} /> : "Save Site"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {isEditProjectOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Edit Project</h2>
            <form onSubmit={handleUpdateProject} className="space-y-4">
              <div><label className={labelCls}>Project Name</label><input required value={editProjectForm.name || ""} onChange={e => setEditProjectForm({...editProjectForm, name: e.target.value})} className={formCls} /></div>
              <div><label className={labelCls}>Start Date</label><input type="date" value={editProjectForm.start_date || ""} onChange={e => setEditProjectForm({...editProjectForm, start_date: e.target.value})} className={formCls} /></div>
              <div><label className={labelCls}>Target End Date</label><input type="date" value={editProjectForm.target_end_date || ""} onChange={e => setEditProjectForm({...editProjectForm, target_end_date: e.target.value})} className={formCls} /></div>
              <button type="submit" disabled={saving} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex justify-center items-center gap-2">
                {saving ? <Loader2 className="animate-spin" size={18}/> : <><Save size={18}/> Save Changes</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}