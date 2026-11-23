"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, UserCheck, ShieldAlert, Loader2, Save } from "lucide-react";
import { createClient } from "@/app/utils/supabase";

type Profile = { id: string; full_name: string | null; role: string | null; can_approve: boolean | null };

export default function SettingsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      const { data: profData } = await supabase.from("profiles").select("*").order("full_name");
      if (profData) {
        setProfiles(profData);
        setMe(profData.find(p => p.id === userId) || null);
      }
      setLoading(false);
    }
    fetchData();
  }, [supabase]);

  const toggleApproval = async (targetId: string, currentStatus: boolean) => {
    if (me?.role !== "manager" && !me?.can_approve) {
      setError("Only the Manager or delegated approvers can change this.");
      return;
    }
    setUpdating(targetId);
    setError(null);
    const { error: err } = await supabase
      .from("profiles")
      .update({ can_approve: !currentStatus })
      .eq("id", targetId);

    if (err) {
      setError(err.message);
    } else {
      setProfiles(profiles.map(p => p.id === targetId ? { ...p, can_approve: !currentStatus } : p));
    }
    setUpdating(null);
  };

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={28} /></div>;

  const isManager = me?.role === "manager" || me?.can_approve === true;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="text-blue-500" /> Settings
        </h1>
        <p className="text-slate-400 mt-1">Manage team permissions, approval delegation, and view platform status.</p>
      </div>

      {error && <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm">{error}</div>}

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <UserCheck className="text-emerald-500" /> Team Members & Approvals
        </h2>
        
        {!isManager && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm flex items-center gap-2">
            <ShieldAlert size={16} /> Only Managers can toggle approval rights.
          </div>
        )}

        <div className="space-y-3">
          {profiles.map(p => (
            <div key={p.id} className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold uppercase">
                  {p.full_name?.charAt(0) || "U"}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{p.full_name || "Unknown"}</p>
                  <p className="text-xs text-slate-400 capitalize">{p.role}</p>
                </div>
              </div>
              <div>
                {p.role === "manager" ? (
                  <span className="text-xs bg-blue-900/30 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-800/50">
                    Manager (Always Approves)
                  </span>
                ) : (
                  <button
                    onClick={() => toggleApproval(p.id, !!p.can_approve)}
                    disabled={!isManager || updating === p.id}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-2 transition-colors ${
                      p.can_approve 
                        ? "bg-emerald-900/20 text-emerald-400 border-emerald-800/50 hover:bg-emerald-900/40" 
                        : "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800"
                    } disabled:opacity-50`}
                  >
                    {updating === p.id ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                    {p.can_approve ? "Can Approve" : "Cannot Approve"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}