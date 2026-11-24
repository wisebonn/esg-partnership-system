"use client";

import { useEffect, useState } from "react";
import { FolderKanban, Plus, Loader2, ArrowRight, X, CheckCircle2, Briefcase, Trash2, ExternalLink } from "lucide-react";
import { createClient } from "@/app/utils/supabase";
import Link from "next/link";

type Project = {
  id: string; name: string; project_type: string | null; status: string | null;
  start_date: string | null; target_end_date: string | null; 
  bc_job_link: string | null; 
  bc_job_number: string | null;
  interventions: string[] | null; tie_to_plan: boolean; period: string | null; partner?: { name: string } | null;
};

type Partner = { id: string; name: string };
type SiteForm = { name: string; location: string; approved_quote: string; actual_spend: string; partner_revenue: string; };

const formCls = "w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-4 text-white focus:outline-none focus:border-blue-500";
const labelCls = "text-xs text-slate-400 mb-1 block";

const PROJECT_TYPES = ["CSR Project", "Grant Project (RBF/OBA)", "Grant Project (MBG/Matching)", "Internal Project"];
const INTERVENTIONS = ["Solar Water Pumping", "Borehole Solarization", "Solar Lighting", "Water Treatment", "Solar Backup", "Irrigation", "Remote Monitoring", "Pool Chemicals"];

const ADMIN_TASKS = [
  { phase: "Assessment", title: "Project Kick-off & Partner Meeting", weight: 2 },
  { phase: "Installation", title: "Mid-term Progress Report Submission", weight: 2 },
  { phase: "Reconciliation", title: "Final Project Report & Handover Certificate", weight: 3 }
];

const TASKS_BY_INTERVENTION: Record<string, { phase: string, title: string, weight: number }[]> = {
  "Solar Water Pumping": [
    { phase: "Assessment", title: "Hydrogeological Survey & Pump Sizing", weight: 2 },
    { phase: "Procurement", title: "Procure Solar Panels & Submersible Pump", weight: 2 },
    { phase: "Installation", title: "Install Solar Array & Pump Setup", weight: 3 },
    { phase: "Commissioning", title: "Pump Performance Test & Flow Rate Verification", weight: 2 }
  ],
  // ... (add others as needed)
};

export default function ProjectsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({ 
    name: "", project_type: "CSR Project", partner_id: "", start_date: "", target_end_date: "", 
    bc_job_link: "", bc_job_number: "", mou_link: "", csr_agreement_link: "", interventions: [] as string[], 
    generate_tasks: true, tie_to_plan: false, period: "Q1"
  });
  
  const [sites, setSites] = useState<SiteForm[]>([]);

  const fetchProjects = async () => {
    setLoading(true); setError(null);
    const { data: partData } = await supabase.from("partners").select("id, name").order("name");
    if (partData) setPartners(partData);

    // Fetches bc_job_link and bc_job_number from DB
    const { data: projData, error: projErr } = await supabase.from("projects").select(`id, name, project_type, status, start_date, target_end_date, bc_job_link, bc_job_number, interventions, tie_to_plan, period, partner:partners(name)`);
    if (projErr) setError(projErr.message);
    else if (projData) setProjects(projData as unknown as Project[]);
    setLoading(false);
  };

  useEffect(() => { fetchProjects(); }, []);

  useEffect(() => { if (sites.length === 0) setSites([{ name: "", location: "", approved_quote: "", actual_spend: "", partner_revenue: "" }]); }, [sites]);

  const toggleIntervention = (item: string) => {
    setForm(prev => ({ ...prev, interventions: prev.interventions.includes(item) ? prev.interventions.filter(i => i !== item) : [...prev.interventions, item] }));
  };

  const updateSite = (index: number, field: keyof SiteForm, value: string) => {
    const newSites = [...sites]; newSites[index] = { ...newSites[index], [field]: value }; setSites(newSites);
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm("Are you sure? This will delete the project, all sites, and all linked tasks permanently.")) return;
    setLoading(true);
    await supabase.from("tasks").delete().eq("project_id", projectId);
    await supabase.from("project_sites").delete().eq("project_id", projectId);
    await supabase.from("projects").delete().eq("id", projectId);
    fetchProjects();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(null); setNotice(null);

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    // Saves bc_job_link and bc_job_number to DB
    const { data: newProject, error: projErr } = await supabase.from("projects").insert({
      name: form.name, project_type: form.project_type, partner_id: form.partner_id || null,
      start_date: form.start_date || null, target_end_date: form.target_end_date || null,
      bc_job_link: form.bc_job_link || null, bc_job_number: form.bc_job_number || null,
      mou_link: form.mou_link || null, csr_agreement_link: form.csr_agreement_link || null,
      interventions: form.interventions, status: "Planning",
      tie_to_plan: form.tie_to_plan, period: form.tie_to_plan ? form.period : null
    }).select("id").single();

    if (projErr || !newProject) { setError(projErr?.message || "Failed to create project"); setSaving(false); return; }

    const sitesPayload = sites.filter(s => s.name.trim() !== "").map(s => ({
      project_id: newProject.id, name: s.name, location: s.location || null,
      approved_quote: parseFloat(s.approved_quote) || 0, actual_spend: parseFloat(s.actual_spend) || 0, partner_revenue: parseFloat(s.partner_revenue) || 0
    }));
    if (sitesPayload.length > 0) {
      await supabase.from("project_sites").insert(sitesPayload);
    }

    if (form.generate_tasks && userId) {
      const tasksToInsert: any[] = [];
      
      ADMIN_TASKS.forEach(t => tasksToInsert.push({ title: t.title, phase: t.phase, project_id: newProject.id, task_type: "project", status: "To Do", weight: t.weight, assigned_to: userId, period: form.tie_to_plan ? form.period : null }));

      form.interventions.forEach(int => {
        const intTasks = TASKS_BY_INTERVENTION[int] || [];
        intTasks.forEach(t => tasksToInsert.push({ title: t.title, phase: t.phase, project_id: newProject.id, task_type: "project", status: "To Do", weight: t.weight, assigned_to: userId, period: form.tie_to_plan ? form.period : null }));
      });
      
      await supabase.from("tasks").insert(tasksToInsert);
    }

    setNotice("Project, sites, and automated tasks created successfully!");
    setIsModalOpen(false);
    setForm({ name: "", project_type: "CSR Project", partner_id: "", start_date: "", target_end_date: "", bc_job_link: "", bc_job_number: "", mou_link: "", csr_agreement_link: "", interventions: [], generate_tasks: true, tie_to_plan: false, period: "Q1" });
    setSites([]); fetchProjects(); setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><FolderKanban className="text-blue-500" /> Projects</h1>
          <p className="text-slate-400">Manage projects, sites, and reconciliation.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl flex items-center gap-2"><Plus size={16} /> Add Project</button>
      </div>

      {error && <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm">{error}</div>}
      {notice && <div className="p-4 bg-emerald-500/10 border border-emerald-500/40 rounded-xl text-emerald-400 text-sm flex items-center gap-2"><CheckCircle2 size={16}/> {notice}</div>}

      {loading ? <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <div key={p.id} className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col gap-3 hover:border-blue-500/30 transition-colors">
              <div>
                <div className="flex justify-between items-start">
                  <h3 className="text-white font-semibold text-lg">{p.name}</h3>
                  <button onClick={() => handleDelete(p.id)} className="text-slate-500 hover:text-red-400 p-1"><Trash2 size={16}/></button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{p.project_type}</span>
                  {p.partner && <span className="text-[10px] uppercase font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1"><Briefcase size={10}/> {p.partner.name}</span>}
                  {p.tie_to_plan && <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">Plan: {p.period}</span>}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.interventions?.map(int => <span key={int} className="text-[9px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">{int}</span>)}
                </div>
              </div>
              <div className="flex justify-between items-center border-t border-slate-800 pt-3 mt-auto">
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400 border border-blue-800/50">{p.status}</span>
                <Link href={`/dashboard/projects/${p.id}`} className="text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1">View Project <ArrowRight size={14} /></Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <h2 className="text-lg font-semibold text-white">Create Project Wizard</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">1. Project Basics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelCls}>Project Name *</label><input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={formCls} /></div>
                  <div><label className={labelCls}>Project Type *</label><select value={form.project_type} onChange={e => setForm({...form, project_type: e.target.value})} className={formCls}>{PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                </div>
                <div>
                  <div className="flex justify-between items-end mb-1">
                    <label className={labelCls}>Partner Organization</label>
                    <Link href="/dashboard/partners" target="_blank" className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 mb-1">
                      <ExternalLink size={10} /> Add New Partner
                    </Link>
                  </div>
                  <select value={form.partner_id} onChange={e => setForm({...form, partner_id: e.target.value})} className={formCls}>
                    <option value="">Internal (No Partner)</option>
                    {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelCls}>Start Date</label><input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} className={formCls} /></div>
                  <div><label className={labelCls}>Target End Date</label><input type="date" value={form.target_end_date} onChange={e => setForm({...form, target_end_date: e.target.value})} className={formCls} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelCls}>BC Job Link (Optional)</label><input value={form.bc_job_link} onChange={e => setForm({...form, bc_job_link: e.target.value})} className={formCls} placeholder="https://..." /></div>
                  <div><label className={labelCls}>BC Job Number (Optional)</label><input value={form.bc_job_number} onChange={e => setForm({...form, bc_job_number: e.target.value})} className={formCls} placeholder="e.g. BC-1024" /></div>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-800 pt-6">
                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">2. Interventions</h3>
                <div className="grid grid-cols-3 gap-3">
                  {INTERVENTIONS.map(int => (
                    <label key={int} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer bg-slate-950 p-2 rounded border border-slate-800 hover:border-slate-700">
                      <input type="checkbox" checked={form.interventions.includes(int)} onChange={() => toggleIntervention(int)} className="rounded bg-slate-900 border-slate-700 text-blue-500" />
                      {int}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-800 pt-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">3. Sites & Financials</h3>
                  <button type="button" onClick={() => setSites([...sites, { name: "", location: "", approved_quote: "", actual_spend: "", partner_revenue: "" }])} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><Plus size={12}/> Add Site</button>
                </div>
                {sites.map((s, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2 p-3 bg-slate-950 border border-slate-800 rounded-lg items-end">
                    <div><label className="text-[10px] text-slate-500 block">Site Name</label><input value={s.name} onChange={e => updateSite(i, "name", e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white" /></div>
                    <div><label className="text-[10px] text-slate-500 block">Location</label><input value={s.location} onChange={e => updateSite(i, "location", e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white" /></div>
                    <div><label className="text-[10px] text-slate-500 block">Approved Budget</label><input type="number" value={s.approved_quote} onChange={e => updateSite(i, "approved_quote", e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white" /></div>
                    <div><label className="text-[10px] text-slate-500 block">Actual Cost</label><input type="number" value={s.actual_spend} onChange={e => updateSite(i, "actual_spend", e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white" /></div>
                    <div><label className="text-[10px] text-slate-500 block">Partner Revenue</label><input type="number" value={s.partner_revenue} onChange={e => updateSite(i, "partner_revenue", e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white" /></div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-start gap-3">
                <input type="checkbox" checked={form.tie_to_plan} onChange={e => setForm({...form, tie_to_plan: e.target.checked})} className="mt-1 rounded border-slate-700 bg-slate-950 text-indigo-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white flex items-center justify-between">
                    Tie Project to Annual Plan
                    {form.tie_to_plan && (
                      <select value={form.period} onChange={e => setForm({...form, period: e.target.value})} className="bg-slate-900 text-xs text-white px-2 py-1 rounded border border-slate-700">
                        {["Q1", "Q2", "Q3", "Q4"].map(q => <option key={q} value={q}>{q}</option>)}
                      </select>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">If checked, all generated tasks will automatically be assigned to the selected quarter and will contribute to the Plan progress.</p>
                </div>
              </div>

              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start gap-3">
                <input type="checkbox" checked={form.generate_tasks} onChange={e => setForm({...form, generate_tasks: e.target.checked})} className="mt-1 rounded border-slate-700 bg-slate-950 text-blue-500" />
                <div><p className="text-sm font-medium text-white">Auto-generate tasks, meetings & reports</p><p className="text-xs text-slate-400 mt-1">Generates standard tasks, kick-off meetings, and reporting schedules linked to the 5 project phases.</p></div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 bg-slate-800 text-white rounded-lg font-medium">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium">{saving ? <Loader2 className="animate-spin" size={18} /> : "Create Project"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}