"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Target, Plus, Trash2, Loader2, ChevronDown, ChevronRight,
  CheckCircle2, User, Layers, ListChecks, Edit2, Check, X
} from "lucide-react";
import { createClient } from "@/app/utils/supabase";
import { parseNotes, stringifyNotes, formatMoney, type BudgetData } from "@/app/utils/budget";

type Task = {
  id: string; title: string; description: string | null; task_type: string | null;
  status: string | null; dependency: string | null; assigned_to: string | null;
  weight: number | null; notes: string | null; budget?: BudgetData;
};
type Profile = { id: string; full_name: string | null };
type KpiNode = Task & { tasks: Task[]; progress: { total: number; completed: number } };
type GoalNode = Task & { kpis: KpiNode[]; progress: { total: number; completed: number } };
type KeyNode = Task & {
  goals: GoalNode[];
  directKpis: KpiNode[];
  directTasks: Task[];
  progress: { total: number; completed: number };
};

const inputCls = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500";

export default function KpiTracker() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [keyNumbers, setKeyNumbers] = useState<KeyNode[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [expandedKpi, setExpandedKpi] = useState<string | null>(null);

  const [addMode, setAddMode] = useState<"key" | "goal" | "key_kpi" | "key_task" | "kpi" | "task" | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", target: "", bPrev: "", bCurr: "", aPrev: "", aCurr: "", unit: "MKES" });
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBudget, setEditBudget] = useState<BudgetData>({});

  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: allTasks } = await supabase.from("tasks").select("*");
    const { data: profData } = await supabase.from("profiles").select("id, full_name");
    if (profData) setProfiles(profData as Profile[]);

    if (allTasks) {
      const all = (allTasks as Task[]).map(t => ({ ...t, budget: parseNotes(t.notes) }));
      const keyTasks = all.filter((t) => t.task_type === "key_number");
      const goalTasks = all.filter((t) => t.task_type === "goal");
      const kpiTasks = all.filter((t) => t.task_type === "kpi");
      const actionTasks = all.filter((t) => t.task_type === "plan" || t.task_type === "project" || t.task_type === "ad_hoc");

      const tasksUnderKpi = (kpiId: string) => actionTasks.filter((t) => t.dependency === `KPI:${kpiId}`);
      const kpisUnderGoal = (goalId: string) => kpiTasks.filter((t) => t.dependency === `GOAL:${goalId}`);
      const directKpisUnderKey = (keyId: string) => kpiTasks.filter((t) => t.dependency === `KEY:${keyId}`);
      const directTasksUnderKey = (keyId: string) => actionTasks.filter((t) => t.dependency === `KEY:${keyId}`);

      const structured: KeyNode[] = keyTasks.map((key) => {
        let keyTotal = 0; let keyCompleted = 0;

        const linkedGoals = goalTasks.filter((g) => g.dependency === `KEY:${key.id}`);
        const goalsWithKpis: GoalNode[] = linkedGoals.map((goal) => {
          const linkedKpis = kpisUnderGoal(goal.id);
          let goalTotal = 0; let goalCompleted = 0;
          const kpisWithTasks: KpiNode[] = linkedKpis.map((kpi) => {
            const linked = tasksUnderKpi(kpi.id);
            const completed = linked.filter((t) => t.status === "Verified").length;
            goalTotal += linked.length; goalCompleted += completed;
            return { ...kpi, tasks: linked, progress: { total: linked.length, completed } };
          });
          keyTotal += goalTotal; keyCompleted += goalCompleted;
          return { ...goal, kpis: kpisWithTasks, progress: { total: goalTotal, completed: goalCompleted } };
        });

        const directKpis: KpiNode[] = directKpisUnderKey(key.id).map((kpi) => {
          const linked = tasksUnderKpi(kpi.id);
          const completed = linked.filter((t) => t.status === "Verified").length;
          keyTotal += linked.length; keyCompleted += completed;
          return { ...kpi, tasks: linked, progress: { total: linked.length, completed } };
        });

        const directTasks = directTasksUnderKey(key.id);
        keyTotal += directTasks.length;
        keyCompleted += directTasks.filter((t) => t.status === "Verified").length;

        return { ...key, goals: goalsWithKpis, directKpis, directTasks, progress: { total: keyTotal, completed: keyCompleted } };
      });

      setKeyNumbers(structured);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);

    if (addMode === "key") {
      const notesStr = stringifyNotes({
        description: form.description || undefined,
        target_current: form.target || undefined,
        budget_prev: form.bPrev || undefined,
        budget_current: form.bCurr || undefined,
        actual_prev: form.aPrev || undefined,
        actual_current: form.aCurr || undefined,
        unit: form.unit || "MKES",
      });
      await supabase.from("tasks").insert({
        title: form.title.trim(), task_type: "key_number", status: "In Progress", notes: notesStr
      });
    } else if (addMode === "goal" && parentId) {
      await supabase.from("tasks").insert({ title: form.title.trim(), task_type: "goal", status: "To Do", dependency: `KEY:${parentId}` });
    } else if (addMode === "key_kpi" && parentId) {
      await supabase.from("tasks").insert({ title: form.title.trim(), task_type: "kpi", status: "To Do", dependency: `KEY:${parentId}` });
    } else if (addMode === "key_task" && parentId) {
      await supabase.from("tasks").insert({ title: form.title.trim(), task_type: "plan", status: "To Do", dependency: `KEY:${parentId}` });
    } else if (addMode === "kpi" && parentId) {
      await supabase.from("tasks").insert({ title: form.title.trim(), task_type: "kpi", status: "To Do", dependency: `GOAL:${parentId}` });
    } else if (addMode === "task" && parentId) {
      await supabase.from("tasks").insert({ title: form.title.trim(), task_type: "plan", status: "To Do", dependency: `KPI:${parentId}` });
    }

    setAddMode(null); setParentId(null); setForm({ title: "", description: "", target: "", bPrev: "", bCurr: "", aPrev: "", aCurr: "", unit: "MKES" });
    setSaving(false); loadData();
  };

  const saveBudget = async (id: string) => {
    setSaving(true);
    const notesStr = stringifyNotes(editBudget);
    await supabase.from("tasks").update({ notes: notesStr }).eq("id", id);
    setEditingId(null);
    setSaving(false);
    loadData();
  };

  const handleDelete = async (id: string, kind: string) => {
    if (!confirm(`Delete this ${kind}? Linked items will be unlinked.`)) return;
    await supabase.from("tasks").delete().eq("id", id);
    loadData();
  };

  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Target className="text-blue-500" size={20} /> Key Numbers (Strategic Targets)
        </h2>
        <button onClick={() => setAddMode("key")} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1">
          <Plus size={14} /> Add Key Number
        </button>
      </div>

      {addMode === "key" && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Key Number Name</label>
            <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} className={inputCls} placeholder="e.g. Revenue Generated" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Description</label>
            <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className={inputCls} placeholder="Short description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
             <div><label className="text-xs text-slate-400 mb-1 block">Unit (e.g. MKES, %, Persons)</label><input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className={inputCls} placeholder="MKES" /></div>
             <div><label className="text-xs text-slate-400 mb-1 block">Target (Current Year)</label><input type="number" value={form.target} onChange={e => setForm({...form, target: e.target.value})} className={inputCls} placeholder="e.g. 117" /></div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div><label className="text-xs text-slate-400 mb-1 block">{prevYear} BUD</label><input type="number" value={form.bPrev} onChange={e => setForm({...form, bPrev: e.target.value})} className={inputCls} placeholder="45" /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">{currentYear} BUD</label><input type="number" value={form.bCurr} onChange={e => setForm({...form, bCurr: e.target.value})} className={inputCls} placeholder="117" /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">{prevYear} Actual</label><input type="number" value={form.aPrev} onChange={e => setForm({...form, aPrev: e.target.value})} className={inputCls} placeholder="0" /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">{currentYear} Actual</label><input type="number" value={form.aCurr} onChange={e => setForm({...form, aCurr: e.target.value})} className={inputCls} placeholder="0" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAddMode(null)} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">{saving ? <Loader2 className="animate-spin" size={16}/> : "Save"}</button>
          </div>
        </form>
      )}

      {addMode !== "key" && addMode !== null && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <label className="text-xs text-slate-400 mb-1 block">
              {addMode === "goal" ? "Goal Name" : addMode === "key_kpi" ? "Performance Target (KPI)" : "Task Name"}
            </label>
            <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} className={inputCls} placeholder="Enter title..." />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAddMode(null)} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">{saving ? <Loader2 className="animate-spin" size={16}/> : "Save"}</button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {keyNumbers.length === 0 && <p className="text-sm text-slate-500">No Key Numbers added yet.</p>}
        {keyNumbers.map(key => {
          const percent = key.progress.total > 0 ? (key.progress.completed / key.progress.total) * 100 : 0;
          const isExpanded = expandedKey === key.id;
          const b = key.budget || {};
          
          const bCurr = Number(b.budget_current) || 0;
          const aCurr = Number(b.actual_current) || 0;
          const budgetPercent = bCurr > 0 ? Math.min((aCurr / bCurr) * 100, 100) : 0;
          const unit = b.unit || "MKES";

          const isEditing = editingId === key.id;

          return (
            <div key={key.id} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-900 transition-colors gap-4" onClick={() => setExpandedKey(isExpanded ? null : key.id)}>
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className={`p-2 rounded-lg shrink-0 ${percent === 100 ? "bg-emerald-500/20" : "bg-blue-500/20"}`}>
                    <Layers size={20} className={percent === 100 ? "text-emerald-400" : "text-blue-400"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-white truncate">{key.title}</h3>
                    {b.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{b.description}</p>}
                    {b.target_current && <p className="text-xs text-slate-400 font-medium mt-1">Target: {b.target_current}</p>}
                    
                    <div className="mt-2 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full ${percent === 100 ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${percent}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">{key.progress.completed} / {key.progress.total} tasks</p>
                    
                    {bCurr > 0 && (
                      <div className="mt-2 w-full flex items-center gap-2">
                        <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${budgetPercent}%` }} />
                        </div>
                        <p className="text-[10px] text-indigo-400">Budget Execution: {budgetPercent.toFixed(1)}%</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex gap-6 text-right">
                  {!isEditing ? (
                    <>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">{prevYear} BUD ({unit})</p>
                        <p className="text-xl font-bold text-slate-300">{b.budget_prev ? formatMoney(b.budget_prev) : "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-amber-500/70">{currentYear} BUD ({unit})</p>
                        <p className="text-3xl font-bold text-amber-400 leading-none">{b.budget_current ? formatMoney(b.budget_current) : "—"}</p>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-1" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2 items-center justify-end">
                        <span className="text-[10px] text-slate-400">{prevYear} BUD</span>
                        <input type="number" value={editBudget.budget_prev || ""} onChange={e => setEditBudget({...editBudget, budget_prev: e.target.value})} className="w-20 bg-slate-800 text-white text-xs p-1 rounded border border-slate-700 text-right" />
                      </div>
                      <div className="flex gap-2 items-center justify-end">
                        <span className="text-[10px] text-slate-400">{currentYear} BUD</span>
                        <input type="number" value={editBudget.budget_current || ""} onChange={e => setEditBudget({...editBudget, budget_current: e.target.value})} className="w-20 bg-slate-800 text-white text-xs p-1 rounded border border-slate-700 text-right" />
                      </div>
                      <div className="flex gap-2 items-center justify-end">
                        <span className="text-[10px] text-slate-400">Unit</span>
                        <input type="text" value={editBudget.unit || ""} onChange={e => setEditBudget({...editBudget, unit: e.target.value})} className="w-20 bg-slate-800 text-white text-xs p-1 rounded border border-slate-700 text-right" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isEditing ? (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); saveBudget(key.id); }} className="text-emerald-500 hover:text-emerald-400 p-1"><Check size={18} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="text-slate-500 hover:text-slate-400 p-1"><X size={18} /></button>
                    </>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); setEditingId(key.id); setEditBudget(b); }} className="text-slate-500 hover:text-blue-400 p-1"><Edit2 size={16} /></button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(key.id, "Key Number"); }} className="text-slate-500 hover:text-red-400 p-1"><Trash2 size={16} /></button>
                  {isExpanded ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-800 bg-slate-900/50 p-4 pl-12 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => { setParentId(key.id); setAddMode("goal"); }} className="text-xs bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg flex items-center gap-1"><Plus size={12} /> Add Goal</button>
                    <button onClick={() => { setParentId(key.id); setAddMode("key_kpi"); }} className="text-xs bg-slate-800 text-indigo-300 hover:text-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1"><Plus size={12} /> Add Direct KPI</button>
                    <button onClick={() => { setParentId(key.id); setAddMode("key_task"); }} className="text-xs bg-slate-800 text-emerald-300 hover:text-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1"><Plus size={12} /> Add Direct Task</button>
                  </div>

                  {/* Direct KPIs */}
                  {key.directKpis.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide mb-2">Direct Targets</p>
                      {key.directKpis.map((kpi) => (
                        <KpiRow key={kpi.id} kpi={kpi} profiles={profiles} expanded={expandedKpi === kpi.id} onToggle={() => setExpandedKpi(expandedKpi === kpi.id ? null : kpi.id)} onAddTask={() => { setParentId(kpi.id); setAddMode("task"); }} onDelete={() => handleDelete(kpi.id, "KPI")} />
                      ))}
                    </div>
                  )}

                  {/* Direct Tasks */}
                  {key.directTasks.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide mb-2">Direct Tasks</p>
                      {key.directTasks.map((t) => <TaskRow key={t.id} task={t} profiles={profiles} onDelete={() => handleDelete(t.id, "Task")} />)}
                    </div>
                  )}

                  {/* Goals */}
                  {key.goals.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Goals</p>
                      {key.goals.map((goal) => {
                        const isGoalExpanded = expandedGoal === goal.id;
                        const goalPercent = goal.progress.total > 0 ? (goal.progress.completed / goal.progress.total) * 100 : 0;
                        return (
                          <div key={goal.id} className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden mb-2">
                            <div className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-900" onClick={() => setExpandedGoal(isGoalExpanded ? null : goal.id)}>
                              <div className="flex items-center gap-3 flex-1">
                                <CheckCircle2 size={16} className={goalPercent === 100 ? "text-emerald-500" : "text-slate-500"} />
                                <span className="text-sm text-slate-300 font-medium">{goal.title}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-xs text-slate-500">{goal.progress.completed}/{goal.progress.total} done</span>
                                {isGoalExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                              </div>
                            </div>
                            {isGoalExpanded && (
                              <div className="border-t border-slate-800 p-3 pl-8 space-y-3 bg-slate-900/30">
                                <div className="flex justify-between items-center mb-2">
                                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">KPIs under this Goal</p>
                                  <button onClick={() => { setParentId(goal.id); setAddMode("kpi"); }} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"><Plus size={10} /> Add KPI</button>
                                </div>
                                {goal.kpis.length === 0 && <p className="text-xs text-slate-500">No KPIs linked yet.</p>}
                                {goal.kpis.map((kpi) => (
                                  <KpiRow key={kpi.id} kpi={kpi} profiles={profiles} expanded={expandedKpi === kpi.id} onToggle={() => setExpandedKpi(expandedKpi === kpi.id ? null : kpi.id)} onAddTask={() => { setParentId(kpi.id); setAddMode("task"); }} onDelete={() => handleDelete(kpi.id, "KPI")} />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiRow({ kpi, profiles, expanded, onToggle, onAddTask, onDelete }: any) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-md overflow-hidden mb-2">
      <div className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-900" onClick={onToggle}>
        <div className="flex items-center gap-3 flex-1">
          <Target size={14} className="text-indigo-400" />
          <span className="text-xs text-slate-300 font-medium">{kpi.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-500">{kpi.progress.completed}/{kpi.progress.total} done</span>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-slate-500 hover:text-red-400 p-1"><Trash2 size={12} /></button>
          {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-800 p-2 pl-6 space-y-2 bg-slate-900/20">
          <div className="flex justify-between items-center mb-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1"><ListChecks size={10} /> Tasks</p>
            <button onClick={onAddTask} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"><Plus size={10} /> Add Task</button>
          </div>
          {kpi.tasks.length === 0 && <p className="text-[10px] text-slate-500">No tasks linked.</p>}
          {kpi.tasks.map((t: any) => <TaskRow key={t.id} task={t} profiles={profiles} />)}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, profiles, onDelete }: any) {
  const assignee = profiles.find((p: any) => p.id === task.assigned_to)?.full_name || "Unassigned";
  return (
    <div className="flex justify-between items-center p-2 rounded bg-slate-950 border border-slate-800/50 mb-1">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-300 truncate">{task.title}</p>
        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5"><User size={10} /> {assignee}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${task.status === "Verified" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"}`}>{task.status}</span>
        {onDelete && <button onClick={onDelete} className="text-slate-500 hover:text-red-400 p-1"><Trash2 size={12} /></button>}
      </div>
    </div>
  );
}