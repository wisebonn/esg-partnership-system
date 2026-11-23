"use client";

import { useEffect, useState } from "react";
import { Users, Plus, Trash2, Pencil, Loader2, ExternalLink, Phone, Mail, CheckCircle2, LayoutGrid, List, Activity, ArrowRight, ShieldAlert, X, Save, TrendingUp } from "lucide-react";
import { createClient } from "@/app/utils/supabase";
import { PARTNER_CATEGORIES } from "@/app/utils/constants";

type Partner = {
  id: string; name: string; category: string | null; contact_name: string | null;
  contact_phone: string | null; contact_email: string | null; cost_sharing_ratio: string | null;
  partnership_terms: string | null; sales_value: number | null; unit_cost: number | null;
  contract_value: number | null; zoho_link: string | null; pipeline_stage: string | null;
};

const formCls = "w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-4 text-white focus:outline-none focus:border-blue-500";
const STAGES = ["Prospecting", "Discovery", "MOU Review", "Onboarding", "Active & Scaling", "Renewal"];

export default function PartnersPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"dashboard" | "kanban">("dashboard");
  
  // Action Queue Filtering
  const [actionFilter, setActionFilter] = useState<"overdue" | "expiring" | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editPartner, setEditPartner] = useState<Partner | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  const [form, setForm] = useState({
    name: "", category: "Corporate", contact_name: "", contact_phone: "", contact_email: "",
    cost_sharing_ratio: "50/50", partnership_terms: "", sales_value: "", unit_cost: "", contract_value: "", zoho_link: "", pipeline_stage: "Prospecting"
  });

  const fetchPartners = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("partners").select("*").order("name");
    if (error) setError(error.message);
    else setPartners(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPartners(); }, []);

  const openAdd = () => {
    setEditPartner(null);
    setForm({ name: "", category: "Corporate", contact_name: "", contact_phone: "", contact_email: "", cost_sharing_ratio: "50/50", partnership_terms: "", sales_value: "", unit_cost: "", contract_value: "", zoho_link: "", pipeline_stage: "Prospecting" });
    setIsModalOpen(true);
  };

  const openEdit = (p: Partner) => {
    setEditPartner(p);
    setForm({
      name: p.name, category: p.category || "Corporate", contact_name: p.contact_name || "", contact_phone: p.contact_phone || "", contact_email: p.contact_email || "",
      cost_sharing_ratio: p.cost_sharing_ratio || "50/50", partnership_terms: p.partnership_terms || "",
      sales_value: p.sales_value?.toString() || "", unit_cost: p.unit_cost?.toString() || "", contract_value: p.contract_value?.toString() || "", zoho_link: p.zoho_link || "",
      pipeline_stage: p.pipeline_stage || "Prospecting"
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(null); setNotice(null);

    const payload = {
      name: form.name.trim(), category: form.category, pipeline_stage: form.pipeline_stage,
      contact_name: form.contact_name.trim() || null, contact_phone: form.contact_phone.trim() || null, contact_email: form.contact_email.trim() || null,
      cost_sharing_ratio: form.cost_sharing_ratio.trim() || null, partnership_terms: form.partnership_terms.trim() || null,
      sales_value: form.sales_value ? parseFloat(form.sales_value) : 0,
      unit_cost: form.unit_cost ? parseFloat(form.unit_cost) : 0,
      contract_value: form.contract_value ? parseFloat(form.contract_value) : 0,
      zoho_link: form.zoho_link.trim() || null,
    };

    if (editPartner) {
      const { error } = await supabase.from("partners").update(payload).eq("id", editPartner.id);
      if (error) setError(error.message);
      else { setNotice("Partner updated."); setIsModalOpen(false); fetchPartners(); }
    } else {
      const { error } = await supabase.from("partners").insert(payload);
      if (error) setError(error.message);
      else { setNotice("Partner added."); setIsModalOpen(false); fetchPartners(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this partner?")) return;
    await supabase.from("partners").delete().eq("id", id);
    fetchPartners();
  };

  const totalSales = partners.reduce((acc, p) => acc + (Number(p.sales_value) || 0), 0);
  const totalCost = partners.reduce((acc, p) => acc + (Number(p.unit_cost) || 0), 0);
  const profit = totalSales - totalCost;
  const margin = totalSales > 0 ? (profit / totalSales) * 100 : 0;

  // Filter logic for Action Queue
  let displayedPartners = partners;
  if (actionFilter === "overdue") displayedPartners = partners.filter(p => !p.contact_name); // Simple mock for missing contact
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
              <p className="text-xs text-slate-400 uppercase tracking-wider">Total Sales Value</p>
              <p className="text-3xl font-bold text-white mt-2">${totalSales.toLocaleString()}</p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Total Contract Value</p>
              <p className="text-3xl font-bold text-white mt-2">${partners.reduce((acc, p) => acc + (Number(p.contract_value) || 0), 0).toLocaleString()}</p>
            </div>
            <div className="bg-emerald-950/20 border border-emerald-800/50 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10"><TrendingUp size={48}/></div>
              <p className="text-xs text-emerald-400 uppercase tracking-wider">Gross Profit Margin</p>
              <p className="text-3xl font-bold text-emerald-400 mt-2">${profit.toLocaleString()}</p>
              <p className="text-xs font-medium text-emerald-500 mt-1">{margin.toFixed(1)}% Margin</p>
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
                {displayedPartners.map(p => (
                  <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-blue-500/40 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-white font-semibold text-sm cursor-pointer hover:text-blue-400" onClick={() => setSelectedPartner(p)}>{p.name}</h3>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(p)} className="text-slate-500 hover:text-blue-400 p-1"><Pencil size={12}/></button>
                        <button onClick={() => handleDelete(p.id)} className="text-slate-500 hover:text-red-400 p-1"><Trash2 size={12}/></button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">{p.category} • {p.pipeline_stage}</p>
                    <div className="flex justify-between items-center border-t border-slate-800 pt-2">
                      <span className="text-xs text-slate-400">Contract: ${(p.contract_value || 0).toLocaleString()}</span>
                      <button onClick={() => setSelectedPartner(p)} className="text-blue-400 hover:text-blue-300"><ArrowRight size={14} /></button>
                    </div>
                  </div>
                ))}
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
                  {stagePartners.map(p => (
                    <div key={p.id} className="bg-slate-950 border border-slate-800 p-3 rounded-lg cursor-pointer hover:border-blue-500/50">
                      <div className="flex justify-between items-start">
                        <p className="text-xs font-medium text-white" onClick={() => setSelectedPartner(p)}>{p.name}</p>
                        <button onClick={() => openEdit(p)} className="text-slate-500 hover:text-blue-400"><Pencil size={10}/></button>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">${(p.contract_value || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 360 Profile */}
      {selectedPartner && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
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
                    <p><span className="text-slate-500">Contract:</span> ${(selectedPartner.contract_value || 0).toLocaleString()}</p>
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
              <div className="flex-1 p-6 overflow-y-auto">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-4 flex items-center gap-2"><Activity size={14}/> Activity Timeline</h3>
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-800">
                  <div className="relative pl-6">
                    <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-blue-500 border-4 border-slate-900 -translate-x-1.5"></div>
                    <p className="text-xs text-slate-500 mb-1">Latest Note</p>
                    <p className="text-sm text-slate-200">{selectedPartner.partnership_terms || "No notes added yet."}</p>
                  </div>
                </div>
              </div>
              <div className="w-1/4 border-l border-slate-800 p-6 bg-slate-900/30">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-4">Value & KPIs</h3>
                <div className="space-y-4">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase">Revenue Generated</p>
                    <p className="text-lg font-bold text-emerald-400">${(selectedPartner.sales_value || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase">Cost to Serve</p>
                    <p className="text-lg font-bold text-red-400">${(selectedPartner.unit_cost || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase">Net Profit</p>
                    <p className="text-lg font-bold text-blue-400">${((selectedPartner.sales_value || 0) - (selectedPartner.unit_cost || 0)).toLocaleString()}</p>
                    <p className="text-[10px] text-blue-300 mt-1">
                      {selectedPartner.sales_value ? ((((selectedPartner.sales_value || 0) - (selectedPartner.unit_cost || 0)) / selectedPartner.sales_value) * 100).toFixed(1) : "0"}% Margin
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
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-xs text-slate-400 mb-1 block">Sales Value ($)</label><input type="number" value={form.sales_value} onChange={e => setForm({...form, sales_value: e.target.value})} className={formCls} /></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Unit Cost ($)</label><input type="number" value={form.unit_cost} onChange={e => setForm({...form, unit_cost: e.target.value})} className={formCls} /></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Contract Value ($)</label><input type="number" value={form.contract_value} onChange={e => setForm({...form, contract_value: e.target.value})} className={formCls} /></div>
              </div>
              <div><label className="text-xs text-slate-400 mb-1 block">Cost Sharing Ratio</label><input value={form.cost_sharing_ratio} onChange={e => setForm({...form, cost_sharing_ratio: e.target.value})} className={formCls} /></div>
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