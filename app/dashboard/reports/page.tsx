"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/app/utils/supabase";
import { Printer, Loader2, CalendarDays, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { downloadCsv, tasksToCsv } from "@/app/utils/excel";

type Task = {
  id: string;
  title: string;
  status: string;
  weight: number | null;
  due_date: string | null;
  assigned_to: string | null;
  task_type: string | null;
  description?: string | null;
  period?: string | null;
  project_id?: string | null;
  phase?: string | null;
  notes?: string | null;
  doc_link?: string | null;
  budgeted_cost?: number | null;
  actual_cost?: number | null;
  variance?: number | null;
  recurring?: string | null; // Keeping this as string to match your DB
  zoho_link?: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
};

export default function MondayReportPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [weekRange, setWeekRange] = useState({ start: "", end: "" });

  useEffect(() => {
    // 1. Calculate the current week (Monday to Sunday) safely
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
    
    const startObj = new Date(now);
    startObj.setDate(diffToMonday);
    startObj.setHours(0, 0, 0, 0);
    
    const endObj = new Date(startObj);
    endObj.setDate(startObj.getDate() + 6);
    endObj.setHours(23, 59, 59, 999);

    setWeekRange({
      start: startObj.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      end: endObj.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    });

    // 2. Fetch Data
    async function fetchData() {
      setLoading(true);
      
      const { data: taskData } = await supabase
        .from("tasks")
        .select("*")
        .neq("task_type", "kpi")
        .neq("status", "Verified")
        .gte("due_date", startObj.toISOString())
        .lte("due_date", endObj.toISOString())
        .order("due_date", { ascending: true });

      const { data: profData } = await supabase.from("profiles").select("id, full_name, role").order("full_name");

      if (taskData) setTasks(taskData);
      if (profData) setProfiles(profData);
      setLoading(false);
    }
    fetchData();
  }, [supabase]);

  const groupedTasks = useMemo(() => {
    const groups: Record<string, { profile: Profile | null; tasks: Task[] }> = {};
    
    profiles.forEach(p => {
      groups[p.id] = { profile: p, tasks: [] };
    });
    
    groups["unassigned"] = { profile: null, tasks: [] };

    tasks.forEach(t => {
      const key = t.assigned_to || "unassigned";
      if (groups[key]) {
        groups[key].tasks.push(t);
      } else {
        groups["unassigned"].tasks.push(t);
      }
    });

    return Object.values(groups).filter(g => g.tasks.length > 0);
  }, [tasks, profiles]);

  function handleExport() {
    const csv = tasksToCsv(tasks.map((t) => ({
      title: t.title, 
      description: t.description ?? null, 
      status: t.status ?? null, 
      period: t.period ?? null, 
      weight: t.weight ?? null, 
      due_date: t.due_date ?? null, 
      assigned_to: profiles.find(p => p.id === t.assigned_to)?.full_name ?? "Unassigned", 
      project_id: t.project_id ?? null, 
      task_type: t.task_type ?? null, 
      phase: t.phase ?? null, 
      notes: t.notes ?? null, 
      doc_link: t.doc_link ?? null, 
      budgeted_cost: t.budgeted_cost ?? null, 
      actual_cost: t.actual_cost ?? null, 
      variance: t.variance ?? null, 
      // FIX: Convert the string from DB to a boolean for the Excel utility
      recurring: !!t.recurring, 
      zoho_link: t.zoho_link ?? null,
    })));
    downloadCsv(`monday-report-${weekRange.start.replace(/\s/g, '-')}.csv`, csv);
  }

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Header (Non-printable) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="text-blue-500" /> Monday Team Report
          </h1>
          <p className="text-slate-400 mt-1">
            Weekly focus for the week of <strong className="text-white">{weekRange.start}</strong> to <strong className="text-white">{weekRange.end}</strong>.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExport} 
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-xl flex items-center gap-2 shadow-lg"
          >
            <Download size={18} /> Export CSV
          </button>
          <button 
            onClick={() => window.print()} 
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl flex items-center gap-2 shadow-lg shadow-blue-900/30"
          >
            <Printer size={18} /> Print / PDF
          </button>
        </div>
      </div>

      {/* Printable Area */}
      <div className="bg-white text-slate-900 p-8 rounded-2xl shadow-xl print:shadow-none print:p-0 print:bg-transparent">
        
        {/* Report Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">ESG & Partnerships Weekly Report</h2>
            <p className="text-sm font-medium text-slate-600 mt-1">Davis & Shirtliff (Dayliff) · Know H2O Through Experience</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Week Of</p>
            <p className="text-lg font-bold text-slate-900">{weekRange.start}</p>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="mb-8 p-4 bg-slate-100 rounded-lg border border-slate-200 print:bg-slate-50">
          <h3 className="font-bold text-slate-800 mb-2">Executive Summary</h3>
          <p className="text-sm text-slate-700">
            This report outlines the key tasks and deliverables assigned to the ESG team for the current week. 
            There are <strong>{tasks.length} active tasks</strong> requiring attention across <strong>{groupedTasks.length} team members</strong>. 
            Tasks are prioritized by weight (Critical, Medium, Low) and grouped by staff member.
          </p>
        </div>

        {/* Grouped Tasks */}
        <div className="space-y-8">
          {groupedTasks.map(group => (
            <div key={group.profile?.id || "unassigned"} className="break-inside-avoid">
              <div className="flex items-center gap-3 mb-3 border-b border-slate-300 pb-2">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                  {group.profile?.full_name?.charAt(0) || "U"}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-lg">{group.profile?.full_name || "Unassigned Tasks"}</h4>
                  <p className="text-xs text-slate-500 capitalize">{group.profile?.role || "Staff"}</p>
                </div>
                <span className="ml-auto text-sm font-semibold text-slate-600">
                  {group.tasks.length} Task{group.tasks.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-2">
                {group.tasks.map(t => (
                  <div key={t.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded border border-slate-200 print:bg-white print:border-slate-300">
                    <div className="mt-0.5">
                      {t.weight === 3 ? <AlertTriangle size={16} className="text-red-600" /> : 
                       t.weight === 2 ? <AlertTriangle size={16} className="text-amber-500" /> : 
                       <CheckCircle2 size={16} className="text-emerald-500" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-slate-800 text-sm">{t.title}</p>
                        <span className="text-xs font-bold text-slate-500 whitespace-nowrap ml-4">
                          {t.due_date ? new Date(t.due_date).toLocaleDateString("en-GB", { weekday: 'short', day: 'numeric', month: 'short' }) : "No Date"}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded print:bg-slate-100">
                          {t.task_type || "Plan"}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded print:bg-slate-100">
                          {t.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {groupedTasks.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-500 opacity-50" />
              <p className="text-lg font-medium">No tasks due this week.</p>
              <p className="text-sm">The team is clear ahead.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-4 border-t border-slate-300 text-center text-xs text-slate-500">
          Generated on {new Date().toLocaleDateString("en-GB", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} by EPAS · Davis & Shirtliff
        </div>
      </div>
    </div>
  );
}