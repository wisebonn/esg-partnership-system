"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  CalendarCheck, Plus, Loader2, Users, X, Sparkles, Copy, 
  CheckCircle2, Clock, Pencil, Trash2, ArrowUpRight, RefreshCw
} from "lucide-react";
import { createClient } from "@/app/utils/supabase";
import { buildMeetingPrompt, matchMemberId, parseMeetingJson } from "@/app/utils/aiImport";

type Meeting = {
  id: string;
  title: string;
  date: string | null;
  minutes_summary: string | null;
  category: string | null;
  created_by: string | null;
  project_id: string | null;
  goal_id: string | null;
  partner_id: string | null;
  is_recurring: boolean | null;
  recurrence_rule: string | null;
};

type Task = {
  id: string;
  meeting_id: string;
  title: string;
  assigned_to: string | null;
  due_date: string | null;
  weight: number | null;
  status: string;
  notes: string | null;
};

type Profile = { id: string; full_name: string | null };
type Project = { id: string; name: string };
type Goal = { id: string; title: string };
type Partner = { id: string; name: string };

type ExtractedTask = {
  id: string;
  title: string;
  assignee_id: string;
  due_date: string;
  weight: 1 | 2 | 3;
  notes: string;
};

const formCls = "w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-4 text-white focus:outline-none focus:border-blue-500";
const inputCls = "w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2 text-sm text-white focus:outline-none focus:border-blue-500";

export default function MeetingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [meId, setMeId] = useState<string | null>(null);

  // Filter & UI State
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [activeTab, setActiveTab] = useState<"brief" | "pending" | "completed">("brief");

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAiPrompt, setShowAiPrompt] = useState(true);
  const [pasteText, setPasteText] = useState("");
  
  const [extractedMeeting, setExtractedMeeting] = useState<{
    title: string, date: string, summary: string, category: string, 
    project_id: string, goal_id: string, partner_id: string,
    is_recurring: boolean, recurrence_rule: string
  } | null>(null);
  
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);

  // Inline Create States
  const [newProjectName, setNewProjectName] = useState("");
  const [newGoalName, setNewGoalName] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    setMeId(session?.user?.id ?? null);

    const [meetRes, taskRes, profRes, projRes, goalRes, partRes] = await Promise.all([
      supabase.from("meetings").select("*").order("date", { ascending: false }),
      supabase.from("tasks").select("*").not("meeting_id", "is", null),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      supabase.from("projects").select("id, name").order("name"),
      supabase.from("tasks").select("id, title").eq("task_type", "plan").like("dependency", "KPI:%"),
      supabase.from("partners").select("id, name").order("name")
    ]);

    if (meetRes.data) setMeetings(meetRes.data);
    if (taskRes.data) setTasks(taskRes.data);
    if (profRes.data) setProfiles(profRes.data);
    if (projRes.data) setProjects(projRes.data);
    if (goalRes.data) setGoals(goalRes.data);
    if (partRes.data) setPartners(partRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // --- METRICS ---
  const totalMeetings = meetings.length;
  const pendingTasks = tasks.filter(t => t.status !== "Verified");
  const completedTasks = tasks.filter(t => t.status === "Verified");
  const pendingUrgent = pendingTasks.filter(t => t.weight === 3).length;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  // --- MODAL HANDLERS ---
  const openNewModal = () => {
    setExtractedMeeting({
      title: "", date: new Date().toISOString().slice(0, 10), summary: "", 
      category: "Internal Sync", project_id: "", goal_id: "", partner_id: "",
      is_recurring: false, recurrence_rule: "weekly"
    });
    setExtractedTasks([]);
    setPasteText("");
    setShowAiPrompt(true);
    setIsModalOpen(true);
  };

  const openEditModal = (m: Meeting) => {
    setExtractedMeeting({
      title: m.title, date: m.date || "", summary: m.minutes_summary || "", 
      category: m.category || "Internal Sync", project_id: m.project_id || "", 
      goal_id: m.goal_id || "", partner_id: m.partner_id || "",
      is_recurring: m.is_recurring || false, recurrence_rule: m.recurrence_rule || "weekly"
    });
    setExtractedTasks([]);
    setPasteText("");
    setShowAiPrompt(false);
    setIsModalOpen(true);
  };

  const handleParseAi = () => {
    try {
      const data = parseMeetingJson(pasteText);
      
      setExtractedMeeting({
        title: data.title,
        date: data.date || "",
        summary: data.summary,
        category: data.category,
        project_id: "",
        goal_id: "",
        partner_id: "",
        is_recurring: false,
        recurrence_rule: "weekly"
      });

      const parsedTasks: ExtractedTask[] = data.tasks.map((t: any, i: number) => ({
        id: `task-${i}-${Date.now()}`,
        title: t.title || "",
        assignee_id: matchMemberId(t.assignee, profiles) || meId || "",
        due_date: t.due_date || "",
        weight: t.weight || 2,
        notes: t.notes || ""
      }));

      setExtractedTasks(parsedTasks);
      setShowAiPrompt(false);
    } catch (err: any) {
      alert(err.message || "Failed to parse JSON.");
    }
  };

  const skipAi = () => {
    setShowAiPrompt(false);
  };

  const updateExtractedTask = (id: string, patch: Partial<ExtractedTask>) => {
    setExtractedTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  };

  const addManualTask = () => {
    setExtractedTasks(prev => [
      ...prev, 
      { id: `manual-${Date.now()}`, title: "", assignee_id: meId || "", due_date: "", weight: 2, notes: "" }
    ]);
  };

  const removeTask = (id: string) => {
    setExtractedTasks(prev => prev.filter(t => t.id !== id));
  };

  // --- SAVE MEETING ---
  const handleSave = async () => {
    if (!extractedMeeting || !extractedMeeting.title.trim()) return alert("Meeting title is required.");
    setSaving(true);

    let finalProjectId = extractedMeeting.project_id;
    let finalGoalId = extractedMeeting.goal_id;

    // Inline Create Project
    if (extractedMeeting.project_id === "NEW" && newProjectName.trim()) {
      const { data: newProj } = await supabase.from("projects").insert({ name: newProjectName.trim(), status: "Planning" }).select("id").single();
      if (newProj) finalProjectId = newProj.id;
    }

    // Inline Create Goal
    if (extractedMeeting.goal_id === "NEW" && newGoalName.trim()) {
      const { data: newGoal } = await supabase.from("tasks").insert({ title: newGoalName.trim(), task_type: "plan", status: "To Do", weight: 3 }).select("id").single();
      if (newGoal) finalGoalId = newGoal.id;
    }

    const meetingPayload = {
      title: extractedMeeting.title,
      date: extractedMeeting.date || null,
      minutes_summary: extractedMeeting.summary,
      category: extractedMeeting.category,
      project_id: finalProjectId === "NEW" ? null : (finalProjectId || null),
      goal_id: finalGoalId === "NEW" ? null : (finalGoalId || null),
      partner_id: extractedMeeting.partner_id || null,
      is_recurring: extractedMeeting.is_recurring,
      recurrence_rule: extractedMeeting.is_recurring ? extractedMeeting.recurrence_rule : null,
      created_by: meId
    };

    let meetingId = activeMeeting?.id;

    if (meetingId) {
      const { error } = await supabase.from("meetings").update(meetingPayload).eq("id", meetingId);
      if (error) { alert("Failed to update meeting."); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("meetings").insert(meetingPayload).select("id").single();
      if (error) { alert("Failed to create meeting."); setSaving(false); return; }
      meetingId = data.id;
    }

    if (extractedTasks.length > 0 && meetingId) {
      const tasksToInsert = extractedTasks.filter(t => t.title.trim() !== "").map(t => ({
        title: t.title,
        task_type: "ad_hoc",
        meeting_id: meetingId,
        assigned_to: t.assignee_id || null,
        weight: t.weight,
        due_date: t.due_date || null,
        status: "To Do",
        notes: t.notes,
        project_id: finalProjectId !== "NEW" && finalProjectId ? finalProjectId : null,
        dependency: finalGoalId !== "NEW" && finalGoalId ? `GOAL:${finalGoalId}` : null
      }));
      if (tasksToInsert.length > 0) {
        await supabase.from("tasks").insert(tasksToInsert);
      }
    }

    setIsModalOpen(false);
    setActiveMeeting(null);
    fetchData();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this meeting and all its linked tasks?")) return;
    await supabase.from("meetings").delete().eq("id", id);
    setActiveMeeting(null);
    fetchData();
  };

  // Redirect to task center
  const goToTaskCenter = () => {
    router.push("/dashboard/plan");
  };

  const getCategoryColor = (cat: string | null) => {
    if (cat === "Partner Meeting") return "bg-purple-900/40 text-purple-400 border-purple-800/50";
    if (cat === "Project Meeting") return "bg-blue-900/40 text-blue-400 border-blue-800/50";
    if (cat === "Plan Meeting") return "bg-emerald-900/40 text-emerald-400 border-emerald-800/50";
    return "bg-slate-800 text-slate-300 border-slate-700";
  };

  const filteredMeetings = filterCategory ? meetings.filter(m => m.category === filterCategory) : meetings;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><CalendarCheck className="text-blue-500" /> Meeting Hub</h1>
          <p className="text-slate-400">Track meetings, extract action items, and monitor deliverables.</p>
        </div>
        <button onClick={openNewModal} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-900/30">
          <Sparkles size={16} /> Log & Extract
        </button>
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div onClick={() => setFilterCategory(null)} className={`cursor-pointer p-4 rounded-xl border transition-colors ${filterCategory === null ? "bg-slate-800 border-slate-600" : "bg-slate-900/80 border-slate-800 hover:border-slate-600"}`}>
          <p className="text-xs text-slate-400 uppercase tracking-wider">Total Meetings</p>
          <p className="text-3xl font-bold text-white mt-1">{totalMeetings}</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-slate-400 uppercase tracking-wider flex justify-between">
            Open Follow-Ups
            {pendingUrgent > 0 && <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-[10px] border border-red-500/30">{pendingUrgent} High Priority</span>}
          </p>
          <p className="text-3xl font-bold text-amber-400 mt-1">{pendingTasks.length}</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Accomplished</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-3xl font-bold text-emerald-400">{completedTasks.length}</p>
            <p className="text-sm text-slate-500">/ {tasks.length} ({completionRate}%)</p>
          </div>
        </div>
      </div>

      {/* FILTER PILLS */}
      <div className="flex gap-2">
        {["Partner Meeting", "Project Meeting", "Plan Meeting", "Internal Sync"].map(cat => (
          <button key={cat} onClick={() => setFilterCategory(filterCategory === cat ? null : cat)} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${filterCategory === cat ? "bg-blue-600 text-white border-blue-500" : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* CARDS */}
      {loading ? <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMeetings.map(m => {
            const meetingTasks = tasks.filter(t => t.meeting_id === m.id);
            const done = meetingTasks.filter(t => t.status === "Verified").length;
            const percent = meetingTasks.length > 0 ? Math.round((done / meetingTasks.length) * 100) : 0;
            const hasUrgent = meetingTasks.some(t => t.weight === 3 && t.status !== "Verified");

            return (
              <div key={m.id} onClick={() => { setActiveMeeting(m); setActiveTab("brief"); }} className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col gap-3 cursor-pointer hover:border-blue-500/50 transition-colors">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="text-white font-semibold line-clamp-2">{m.title}</h3>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${getCategoryColor(m.category)}`}>{m.category}</span>
                    {m.is_recurring && <span className="text-[10px] text-blue-400 flex items-center gap-1"><RefreshCw size={10}/> {m.recurrence_rule}</span>}
                  </div>
                </div>
                <p className="text-xs text-slate-400">{m.date ? new Date(m.date).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric'}) : "No date"}</p>
                
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>Deliverables</span><span>{done}/{meetingTasks.length} Done</span></div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className={`h-full ${percent === 100 ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${percent}%` }} />
                  </div>
                </div>

                {hasUrgent && <div className="mt-1 text-[10px] text-red-400 bg-red-500/10 px-2 py-1 rounded border border-red-500/20 flex items-center gap-1 w-fit"><Clock size={10} /> High Priority Pending</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* DRAWER */}
      {activeMeeting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-xl bg-slate-900 h-full border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            
            <div className="p-6 border-b border-slate-800 flex justify-between items-start">
              <div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border mb-2 inline-block ${getCategoryColor(activeMeeting.category)}`}>{activeMeeting.category}</span>
                <h2 className="text-xl font-bold text-white pr-4">{activeMeeting.title}</h2>
                <p className="text-sm text-slate-400 mt-1">{activeMeeting.date ? new Date(activeMeeting.date).toLocaleDateString() : ""}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEditModal(activeMeeting)} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-blue-400"><Pencil size={18} /></button>
                <button onClick={() => handleDelete(activeMeeting.id)} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-red-400"><Trash2 size={18} /></button>
                <button onClick={() => setActiveMeeting(null)} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white"><X size={20} /></button>
              </div>
            </div>

            <div className="flex border-b border-slate-800 px-6">
              <button onClick={() => setActiveTab("brief")} className={`py-3 px-4 text-sm font-medium border-b-2 ${activeTab === "brief" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-white"}`}>Brief</button>
              <button onClick={() => setActiveTab("pending")} className={`py-3 px-4 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === "pending" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-white"}`}>
                Pending <span className="bg-slate-800 text-[10px] px-2 py-0.5 rounded-full">{tasks.filter(t => t.meeting_id === activeMeeting.id && t.status !== "Verified").length}</span>
              </button>
              <button onClick={() => setActiveTab("completed")} className={`py-3 px-4 text-sm font-medium border-b-2 ${activeTab === "completed" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-white"}`}>Done</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "brief" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2">Summary</h3>
                    <p className="text-sm text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800 leading-relaxed">{activeMeeting.minutes_summary || "No summary provided."}</p>
                  </div>
                </div>
              )}

              {activeTab === "pending" && (
                <div className="space-y-3">
                  {tasks.filter(t => t.meeting_id === activeMeeting.id && t.status !== "Verified").map(t => {
                    const assignee = profiles.find(p => p.id === t.assigned_to)?.full_name || "Unassigned";
                    return (
                      <div 
                        key={t.id} 
                        onClick={goToTaskCenter}
                        className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-start gap-3 cursor-pointer hover:border-blue-500/50 transition-colors group"
                      >
                        <div className="mt-0.5 text-slate-500 group-hover:text-blue-400"><ArrowUpRight size={18} /></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">{t.title}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1"><Users size={12}/> {assignee}</span>
                            <span className="flex items-center gap-1"><Clock size={12}/> {t.due_date ? new Date(t.due_date).toLocaleDateString() : "No date"}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${t.weight === 3 ? "bg-red-500/20 text-red-400" : "bg-slate-800 text-slate-300"}`}>W{t.weight}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {tasks.filter(t => t.meeting_id === activeMeeting.id && t.status !== "Verified").length === 0 && <p className="text-center text-slate-500 text-sm py-8">All done! 🎉</p>}
                </div>
              )}

              {activeTab === "completed" && (
                <div className="space-y-3">
                  {tasks.filter(t => t.meeting_id === activeMeeting.id && t.status === "Verified").map(t => (
                    <div key={t.id} className="p-3 bg-slate-900/50 border border-slate-800/50 rounded-lg flex items-start gap-3 opacity-70">
                      <div className="mt-0.5 text-emerald-500"><CheckCircle2 size={18} /></div>
                      <div className="flex-1"><p className="text-sm font-medium text-slate-300 line-through">{t.title}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL (Create / Edit) */}
      {isModalOpen && extractedMeeting && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles className="text-indigo-500" /> {activeMeeting ? "Edit Meeting" : "Log & Extract Meeting"}
              </h2>
              <button onClick={() => { setIsModalOpen(false); setActiveMeeting(null); }} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-6">
              
              {/* AI PROMPT UI */}
              {showAiPrompt ? (
                <div className="space-y-4 pb-6 border-b border-slate-800">
                  <p className="text-sm text-slate-400">Copy the prompt, paste it with your notes into any AI, then paste the JSON below. Or skip to fill manually.</p>
                  <div className="flex gap-3">
                    <button onClick={async () => { await navigator.clipboard.writeText(buildMeetingPrompt(profiles.map(p=>p.full_name).filter(Boolean) as string[])); alert("Prompt copied!"); }} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg flex items-center gap-2">
                      <Copy size={16} /> Copy AI Prompt
                    </button>
                    <button onClick={skipAi} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg">
                      Skip AI & Fill Manually
                    </button>
                  </div>
                  <textarea rows={4} value={pasteText} onChange={(e) => setPasteText(e.target.value)} className={formCls} placeholder="Paste JSON here..." />
                  <button onClick={handleParseAi} disabled={!pasteText.trim()} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg disabled:opacity-50">Extract Data</button>
                </div>
              ) : (
                <>
                  {/* MEETING DETAILS FORM */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                    <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-2">Meeting Details</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2"><label className="text-xs text-slate-400 mb-1 block">Title</label><input value={extractedMeeting.title} onChange={e => setExtractedMeeting({...extractedMeeting, title: e.target.value})} className={inputCls} /></div>
                      <div><label className="text-xs text-slate-400 mb-1 block">Date</label><input type="date" value={extractedMeeting.date} onChange={e => setExtractedMeeting({...extractedMeeting, date: e.target.value})} className={inputCls} /></div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Category</label>
                        <select value={extractedMeeting.category} onChange={e => setExtractedMeeting({...extractedMeeting, category: e.target.value})} className={inputCls}>
                          <option value="Partner Meeting">Partner Meeting</option>
                          <option value="Project Meeting">Project Meeting</option>
                          <option value="Plan Meeting">Plan Meeting</option>
                          <option value="Internal Sync">Internal Sync</option>
                        </select>
                      </div>
                      
                      <div className="flex flex-col justify-end">
                        <div className="flex items-center gap-2 h-[34px]">
                          <input type="checkbox" id="recurring" checked={extractedMeeting.is_recurring} onChange={e => setExtractedMeeting({...extractedMeeting, is_recurring: e.target.checked})} className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-500" />
                          <label htmlFor="recurring" className="text-sm text-slate-300 cursor-pointer">Recurring Meeting</label>
                        </div>
                      </div>
                    </div>

                    {extractedMeeting.is_recurring && (
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Repeats</label>
                        <select value={extractedMeeting.recurrence_rule} onChange={e => setExtractedMeeting({...extractedMeeting, recurrence_rule: e.target.value})} className={inputCls}>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                    )}

                    <div><label className="text-xs text-slate-400 mb-1 block">Summary</label><textarea rows={3} value={extractedMeeting.summary} onChange={e => setExtractedMeeting({...extractedMeeting, summary: e.target.value})} className={inputCls} /></div>
                  </div>

                  {/* LINKAGES SECTION */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                    <h3 className="text-sm font-semibold text-blue-400 border-b border-slate-800 pb-2">Linkages</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      {/* Partner Link */}
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Linked Partner</label>
                        <select value={extractedMeeting.partner_id} onChange={e => setExtractedMeeting({...extractedMeeting, partner_id: e.target.value})} className={inputCls}>
                          <option value="">None</option>
                          {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>

                      {/* Project Link */}
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Linked Project</label>
                        <select value={extractedMeeting.project_id} onChange={e => setExtractedMeeting({...extractedMeeting, project_id: e.target.value})} className={inputCls}>
                          <option value="">None</option>
                          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          <option value="NEW">+ Create New Project</option>
                        </select>
                        {extractedMeeting.project_id === "NEW" && (
                          <input autoFocus value={newProjectName} onChange={e => setNewProjectName(e.target.value)} className={`${inputCls} mt-2`} placeholder="New Project Name..." />
                        )}
                      </div>

                      {/* Goal Link */}
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Linked Plan Goal</label>
                        <select value={extractedMeeting.goal_id} onChange={e => setExtractedMeeting({...extractedMeeting, goal_id: e.target.value})} className={inputCls}>
                          <option value="">None</option>
                          {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                          <option value="NEW">+ Create New Goal</option>
                        </select>
                        {extractedMeeting.goal_id === "NEW" && (
                          <input autoFocus value={newGoalName} onChange={e => setNewGoalName(e.target.value)} className={`${inputCls} mt-2`} placeholder="New Goal Name..." />
                        )}
                      </div>

                    </div>
                  </div>

                  {/* TASKS TABLE */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <h3 className="text-sm font-semibold text-white">Deliverables ({extractedTasks.length})</h3>
                      <button onClick={addManualTask} className="px-3 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 text-xs font-medium rounded-lg flex items-center gap-1 transition-colors">
                        <Plus size={14} /> Add Task
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 text-slate-400">
                          <tr>
                            <th className="px-2 py-2">Task Title</th>
                            <th className="px-2 py-2">Assignee</th>
                            <th className="px-2 py-2">Due Date</th>
                            <th className="px-2 py-2">Wt</th>
                            <th className="px-2 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {extractedTasks.map(t => (
                            <tr key={t.id}>
                              <td className="px-2 py-2 min-w-[200px]"><input value={t.title} onChange={e => updateExtractedTask(t.id, { title: e.target.value })} className={inputCls} placeholder="Task description..." /></td>
                              <td className="px-2 py-2">
                                <select value={t.assignee_id} onChange={e => updateExtractedTask(t.id, { assignee_id: e.target.value })} className={inputCls}>
                                  <option value="">Unassigned</option>
                                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-2"><input type="date" value={t.due_date} onChange={e => updateExtractedTask(t.id, { due_date: e.target.value })} className={inputCls} /></td>
                              <td className="px-2 py-2">
                                <select value={t.weight} onChange={e => updateExtractedTask(t.id, { weight: Number(e.target.value) as 1|2|3 })} className={inputCls}>
                                  <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                                </select>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <button onClick={() => removeTask(t.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={16} /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button onClick={() => { setShowAiPrompt(true); if(!activeMeeting) setExtractedTasks([]); }} className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium">Back to AI</button>
                    <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg flex items-center gap-2 disabled:opacity-50">
                      {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />} Save Meeting
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}