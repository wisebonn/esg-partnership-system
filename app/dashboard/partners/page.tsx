"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Users, Plus, Trash2, Pencil, Loader2, ExternalLink, Phone, Mail, CheckCircle2, LayoutGrid, List, Activity, ArrowRight, ShieldAlert, X, DollarSign, CalendarCheck } from "lucide-react";
import { createClient } from "@/app/utils/supabase";
import { PARTNER_CATEGORIES } from "@/app/utils/constants";

type Partner = {
  id: string; name: string; category: string | null; contact_name: string | null;
  contact_phone: string | null; contact_email: string | null; cost_sharing_ratio: string | null;
  partnership_terms: string | null; contract_value: number | null; zoho_link: string | null; 
  pipeline_stage: string | null;
};

type LinkedProject = { id: string; name: string; status: string | null; approved_budget: number; partner_revenue: number; };
type TimelineEvent = { id: string; title: string; date: string; type: 'meeting' | 'call'; category?: string | null; };

const formCls = "w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-4 text-white focus:outline-none focus:border-blue-500";
const STAGES = ["Prospecting", "Discovery", "MOU Review", "Onboarding", "Active & Scaling", "Renewal"];

export default function PartnersPage() {
  const supabase = createClient();
  const pathname = usePathname();
  
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [projects, setProjects] = useState<Record<string, LinkedProject[]>>({});
  const [timeline, setTimeline] = useState<Record<string, TimelineEvent[]>>({});
  
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"dashboard" | "kanban">("dashboard");
  const [actionFilter, setActionFilter] = useState<"overdue" | "expiring" | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editPartner, setEditPartner] = useState<Partner | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  const [form, setForm] = useState({
    name: "", category: "Corporate", contact_name: "", contact_phone: "", contact_email: "",
    cost_sharing_ratio: "50/50", partnership_terms: "", contract_value: "", zoho_link: "", pipeline_stage: "Prospecting"
  });

  const fetchData = async () => {
    setLoading(true);
    
    const { data: partData, error: partErr } = await supabase.from("partners").select("*").order("name");
    if (partErr) setError(partErr.message);
    else setPartners(partData || []);

    // Fetch projects and their sites to calculate approved budget
    const { data: projData } = await supabase.from("projects").select("id, name, status, partner_id").not("partner_id", "is", null);
    const { data: siteData } = await supabase.from("project_sites").select("project_id, approved_quote, partner_revenue");

    if (projData && siteData) {
      const projMap: Record<string, LinkedProject[]> = {};
      projData.forEach((p: any) => {
        const sitesForProject = siteData.filter((s: any) => s.project_id === p.id);
        const approvedBudget = sitesForProject.reduce((sum: number, s: any) => sum + (Number(s.approved_quote) || 0), 0);
        const partnerRev = sitesForProject.reduce((sum: number, s: any) => sum + (Number(s.partner_revenue) || 0), 0);

        if (!projMap[p.partner_id]) projMap[p.partner_id] = [];
        projMap[p.partner_id].push({ 
          id: p.id, 
          name: p.name, 
          status: p.status, 
          approved_budget: approvedBudget,
          partner_revenue: partnerRev 
        });
      });
      setProjects(projMap);
    }

    const [meetRes, callRes] = await Promise.all([
      supabase.from("meetings").select("id, title, date, category, partner_id").not("partner_id", "is", null),
      supabase.from("call_logs").select("id, title, date, partner_id").not("partner_id", "is", null)
    ]);

    const timelineMap: Record<string, TimelineEvent[]> = {};
    (meetRes.data || []).forEach((m: any) => {
      if (!timelineMap[m.partner_id]) timelineMap[m.partner_id] = [];
      timelineMap[m.partner_id].push({ id: m.id, title: m.title, date: m.date, category: m.category, type: 'meeting' });
    });
    (callRes.data || []).forEach((c: any) => {
      if (!timelineMap[c.partner_id]) timelineMap[c.partner_id] = [];
      timelineMap[c.partner_id].push({ id: c.id, title: c.title, date: c.date, type: 'call' });
    });
    setTimeline(timelineMap);
    
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [pathname]);

  const openAdd = () => {
    setEditPartner(null);
    setForm({ name: "", category: "Corporate", contact_name: "", contact_phone: "", contact_email: "", cost_sharing_ratio: "50/50", partnership_terms: "", contract_value: "", zoho_link: "", pipeline_stage: "Prospecting" });
    setIsModalOpen(true);
  };

  const openEdit = (p: Partner) => {
    setEditPartner(p);
    setForm({
      name: p.name, category: p.category || "Corporate", contact_name: p.contact_name || "", contact_phone: p.contact_phone || "", contact_email: p.contact_email || "",
      cost_sharing_ratio: p.cost_sharing_ratio || "50/50", partnership_terms: p.partnership_terms || "",
      contract_value: p.contract_value?.toString() || "", zoho_link: p.zoho_link || "", pipeline_stage: p.pipeline_stage || "Prospecting"
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(null); setNotice(null);

    const payload = {
      name: form.name.trim(), category: form.category, pipeline_stage: form.pipeline_stage,
      contact_name: form.contact_name.trim() || null, contact_phone: form.contact_phone.trim() || null, contact_email: form.contact_email.trim() || null,
      cost_sharing_ratio: form.cost_sharing_ratio.trim() || null, partnership_terms: form.partnership_terms.trim() || null,
      contract_value: form.contract_value ? parseFloat(form.contract_value) : 0,
      zoho_link: form.zoho_link.trim() || null,
    };

    if (editPartner) {
      const { error } = await supabase.from("partners").update(payload).eq("id", editPartner.id);
      if (error) setError(error.message);
      else { setNotice("Partner updated."); setIsModalOpen(false); fetchData(); }
    } else {
      const { error } = await supabase.from("partners").insert(payload);
      if (error) setError(error.message);
      else { setNotice("Partner added."); setIsModalOpen(false); fetchData(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this partner?")) return;
    await supabase.from("partners").delete().eq("id", id);
    fetchData();
  };

  // --- CALCULATIONS ---
  let totalRevenue = 0;
  let totalContractValue = 0; // Now reflects Approved Budget of linked projects

  Object.values(projects).forEach(projList => {
    projList.forEach(p => {
      totalRevenue += p.partner_revenue;
      totalContractValue += p.approved_budget;
    });
  });

  let totalInteractions = 0;
  Object.values(timeline).forEach(tList => totalInteractions += tList.length);

  let displayedPartners = partners;
  if (actionFilter === "overdue") displayedPartners = partners.filter(p => !p.contact_name);
  if (actionFilter === "expiring") displayedPartners = partners.filter(p => p.pipeline_stage === "Renewal");

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Users className="text-blue-500" /> Partner CRM</h1>
          <p className="text-slate-400">Manage relationships, pipeline, and strategic value.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
            <button onClick={() => { setViewMode("dashboard"); setActionFilter(null); }} className={"px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-2 " + (viewMode === "dashboard" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white")}><LayoutGrid size={14} /> Dashboard</button>
            <button onClick={() => { setViewMode("kanban"); setActionFilter(null); }} className={"px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-2 " + (viewMode === "kanban" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white")}><List size={14} /> Pipeline</button>
          </div>
          <button onClick={openAdd} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl flex items-center gap-2">
            <Plus size={16} /> Add Partner
          </button>
        </div>
      </div>

      {error && <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm">{error}</div>}
      {notice && <div className="p-4 bg-emerald-500/10 border border-emerald-500/40 rounded-xl text-emerald-400 text-sm flex items-center gap-2"><CheckCircle2 size={16}/> {notice}</div>}

      {loading ? <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div> : viewMode === "dashboard" ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Total Active Partners</p>
              <p className="text-3xl font-bold text-white mt-2">{partners.length}</p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1"><DollarSign size={12}/> Revenue from Projects</p>
              <p className="text-3xl font-bold text-emerald-400 mt-2">{totalRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Total Contract Value</p>
              <p className="text-3xl font-bold text-white mt-2">{totalContractValue.toLocaleString()}</p>
            </div>
            <div className="bg-blue-950/20 border border-blue-800/50 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10"><CalendarCheck size={48}/></div>
              <p className="text-xs text-blue-400 uppercase tracking-wider">Partner Interactions</p>
              <p className="text-3xl font-bold text-blue-400 mt-2">{totalInteractions}</p>
              <p className="text-xs font-medium text-blue-500 mt-1">Logged Meetings & Calls</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wide flex items-center gap-2">
                  <Activity size={16} className="text-blue-500"/> Partner Directory
                  {actionFilter && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full ml-2">Filtered: {actionFilter}</span>}
                </h2>
                {actionFilter && <button onClick={() => setActionFilter(null)} className="text-xs text-slate-400 hover:text-white flex items-center gap-1"><X size={12}/> Clear Filter</button>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedPartners.length === 0 && <p className="text-sm text-slate-500">No partners match this filter.</p>}
                {displayedPartners.map(p => {
                  const pProjects = projects[p.id] || [];
                  const pTimeline = timeline[p.id] || [];
                  return (
                    <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-blue-500/40 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-white font-semibold text-sm cursor-pointer hover:text-blue-400" onClick={() => setSelectedPartner(p)}>{p.name}</h3>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(p)} className="text-slate-500 hover:text-blue-400 p-1"><Pencil size={12}/></button>
                          <button onClick={() => handleDelete(p.id)} className="text-slate-500 hover:text-red-400 p-1"><Trash2 size={12}/></button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">{p.category} • {p.pipeline_stage}</p>
                      
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-slate-900 rounded p-2">
                          <p className="text-[10px] text-slate-500 uppercase">Revenue</p>
                          <p className="text-xs font-bold text-emerald-400">{pProjects.reduce((a,b)=>a+b.partner_revenue,0).toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-900 rounded p-2">
                          <p className="text-[10px] text-slate-500 uppercase">Interactions</p>
                          <p className="text-xs font-bold text-blue-400">{pTimeline.length}</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center border-t border-slate-800 pt-2">
                        <span className="text-xs text-slate-400">Linked Projects: {pProjects.length}</span>
                        <button onClick={() => setSelectedPartner(p)} className="text-blue-400 hover:text-blue-300"><ArrowRight size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide flex items-center gap-2"><ShieldAlert size={16} className="text-amber-500"/> Action Queue</h2>
              <div className="space-y-3">
                <button onClick={() => setActionFilter("overdue")} className={"w-full text-left p-3 rounded-lg border transition-all " + (actionFilter === "overdue" ? "bg-red-500/20 border-red-500/50" : "bg-red-500/10 border-red-500/20 hover:border-red-500/40")}>
                  <p className="text-xs font-semibold text-red-400 flex items-center justify-between">Overdue Check-ins <ArrowRight size={12}/></p>
                  <p className="text-[10px] text-slate-400 mt-1">Partners missing contact info or recent notes.</p>
                </button>
                <button onClick={() => setActionFilter("expiring")} className={"w-full text-left p-3 rounded-lg border transition-all " + (actionFilter === "expiring" ? "bg-amber-500/20 border-amber-500/50" : "bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40")}>
                  <p className="text-xs font-semibold text-amber-400 flex items-center justify-between">Expiring Agreements <ArrowRight size={12}/></p>
                  <p className="text-[10px] text-slate-400 mt-1">Partners in Renewal stage.</p>
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
          {STAGES.map(stage => {
            const stagePartners = partners.filter(p => (p.pipeline_stage || "Prospecting") === stage);
            return (
              <div key={stage} className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 min-w-[200px]">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-2 border-b border-slate-800">{stage} ({stagePartners.length})</h3>
                <div className="space-y-3">
                  {stagePartners.map(p => {
                    const pProjects = projects[p.id] || [];
                    return (
                      <div key={p.id} className="bg-slate-950 border border-slate-800 p-3 rounded-lg cursor-pointer hover:border-blue-500/50">
                        <div className="flex justify-between items-start">
                          <p className="text-xs font-medium text-white" onClick={() => setSelectedPartner(p)}>{p.name}</p>
                          <button onClick={() => openEdit(p)} className="text-slate-500 hover:text-blue-400"><Pencil size={10}/></button>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">{pProjects.reduce((a,b)=>a+b.partner_revenue,0).toLocaleString()}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 360 Profile Modal */}
      {selectedPartner && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-950">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedPartner.name}</h2>
                <p className="text-sm text-slate-400">{selectedPartner.category} Partner • {selectedPartner.pipeline_stage}</p>
              </div>
              <button onClick={() => setSelectedPartner(null)} className="text-slate-400 hover:text-white bg-slate-900 p-2 rounded-lg">✕</button>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
              <div className="w-1/3 border-r border-slate-800 p-6 overflow-y-auto space-y-6 bg-slate-900/30">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Account Details</h3>
                  <div className="space-y-2 text-sm text-slate-300">
                    <p><span className="text-slate-500">Terms:</span> {selectedPartner.cost_sharing_ratio}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Key Contacts</h3>
                  <div className="space-y-2 text-sm text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <p className="font-medium text-white">{selectedPartner.contact_name || "No name provided"}</p>
                    {selectedPartner.contact_email && <p className="flex items-center gap-2 text-xs text-slate-400"><Mail size={12}/> {selectedPartner.contact_email}</p>}
                    {selectedPartner.contact_phone && <p className="flex items-center gap-2 text-xs text-slate-400"><Phone size={12}/> {selectedPartner.contact_phone}</p>}
                  </div>
                </div>
                {selectedPartner.zoho_link && (
                  <a href={selectedPartner.zoho_link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700">
                    Open in Zoho <ExternalLink size={14} />
                  </a>
                )}
              </div>

              <div className="flex-1 p-6 overflow-y-auto space-y-8">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2"><Activity size={14}/> Linked Projects</h3>
                  {(!projects[selectedPartner.id] || projects[selectedPartner.id].length === 0) ? (
                    <p className="text-sm text-slate-500 italic">No projects linked to this partner yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {projects[selectedPartner.id].map(proj => (
                        <div key={proj.id} className="flex justify-between items-center p-3 bg-slate-950 border border-slate-800 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-white">{proj.name}</p>
                            <p className="text-xs text-slate-400">{proj.status}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500 uppercase">Contract (Budget)</p>
                            <p className="text-sm font-bold text-emerald-400">{proj.approved_budget.toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase mb-4 flex items-center gap-2"><CalendarCheck size={14}/> Interaction Timeline</h3>
                  {(!timeline[selectedPartner.id] || timeline[selectedPartner.id].length === 0) ? (
                    <p className="text-sm text-slate-500 italic">No meetings or calls logged with this partner.</p>
                  ) : (
                    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-800">
                      {timeline[selectedPartner.id]
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map(m => (
                        <div key={m.id} className="relative pl-6">
                          <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-4 border-slate-900 -translate-x-1.5 ${m.type === 'meeting' ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                          <p className="text-xs text-slate-500 mb-1">{new Date(m.date).toLocaleDateString()} • {m.type === 'meeting' ? m.category : 'Call'}</p>
                          <p className="text-sm text-slate-200">{m.title}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="w-1/4 border-l border-slate-800 p-6 bg-slate-900/30">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-4">Value & KPIs</h3>
                <div className="space-y-4">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase">Revenue Generated</p>
                    <p className="text-lg font-bold text-emerald-400">
                      {(projects[selectedPartner.id] || []).reduce((acc, p) => acc + p.partner_revenue, 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase">Projects Done</p>
                    <p className="text-lg font-bold text-white">
                      {(projects[selectedPartner.id] || []).length}
                    </p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase">Total Interactions</p>
                    <p className="text-lg font-bold text-blue-400">
                      {(timeline[selectedPartner.id] || []).length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <h2 className="text-lg font-semibold text-white">{editPartner ? "Edit Partner" : "Add Partner"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-slate-400 mb-1 block">Partner Name *</label><input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={formCls} /></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Category</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className={formCls}>
                    {PARTNER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-slate-400 mb-1 block">Pipeline Stage</label>
                  <select value={form.pipeline_stage} onChange={e => setForm({...form, pipeline_stage: e.target.value})} className={formCls}>
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-slate-400 mb-1 block">Zoho Link</label><input value={form.zoho_link} onChange={e => setForm({...form, zoho_link: e.target.value})} className={formCls} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-xs text-slate-400 mb-1 block">Contact Name</label><input value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} className={formCls} /></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Phone</label><input value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})} className={formCls} /></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Email</label><input type="email" value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} className={formCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-slate-400 mb-1 block">Contract Value ($)</label><input type="number" value={form.contract_value} onChange={e => setForm({...form, contract_value: e.target.value})} className={formCls} /></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Cost Sharing Ratio</label><input value={form.cost_sharing_ratio} onChange={e => setForm({...form, cost_sharing_ratio: e.target.value})} className={formCls} /></div>
              </div>
              <div><label className="text-xs text-slate-400 mb-1 block">Partnership Terms / Notes</label><textarea rows={3} value={form.partnership_terms} onChange={e => setForm({...form, partnership_terms: e.target.value})} className={formCls} /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 bg-slate-800 text-white rounded-lg font-medium">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={18} /> : "Save Partner"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}