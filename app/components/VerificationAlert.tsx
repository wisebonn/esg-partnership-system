"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, ArrowRight, UserCheck, ShieldCheck, Loader2 } from "lucide-react";
import { createClient } from "@/app/utils/supabase";
import { useRouter } from "next/navigation";

type Profile = { id: string; full_name: string | null; role: string | null };

export default function VerificationAlert({ pendingCount, me }: { pendingCount: number, me: Profile | null }) {
  const supabase = createClient();
  const router = useRouter();
  const [delegating, setDelegating] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pendingCount >= 5) {
      supabase.from("profiles").select("id, full_name, role").then(({ data }) => {
        if (data) setProfiles(data);
      });
    }
  }, [pendingCount, supabase]);

  if (pendingCount < 5 || !me) return null;

  const isManager = me.role === "manager";

  const handleDelegateColleague = async () => {
    if (!isManager) return;
    setDelegating(true);
    setError(null);
    try {
      // 1. Grant approval rights to everyone else temporarily
      const others = profiles.filter(p => p.id !== me.id && p.role !== "manager");
      for (const p of others) {
        await supabase.from("profiles").update({ can_approve: true }).eq("id", p.id);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delegation failed");
    } finally {
      setDelegating(false);
    }
  };

  const handleDelegateTaskOwner = async () => {
    if (!isManager) return;
    setDelegating(true);
    setError(null);
    try {
      // In this context, delegating to the task owner means granting all staff
      // the ability to verify their own work (or peers' work) temporarily.
      const staff = profiles.filter(p => p.role !== "manager");
      for (const p of staff) {
        await supabase.from("profiles").update({ can_approve: true }).eq("id", p.id);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delegation failed");
    } finally {
      setDelegating(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-red-500/10 p-6 shadow-lg shadow-amber-900/20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-500/20 rounded-full">
            <ShieldAlert className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-amber-200">Verification Backlog: {pendingCount} Tasks</h3>
            <p className="text-sm text-amber-200/70 mt-1 max-w-xl">
              The number of unverified tasks has exceeded the threshold of 5. You must verify these tasks or delegate approval rights to keep the department score moving.
            </p>
            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {isManager && (
            <>
              <button 
                onClick={handleDelegateTaskOwner}
                disabled={delegating}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {delegating ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
                Delegate to Staff
              </button>
              <button 
                onClick={handleDelegateColleague}
                disabled={delegating}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-xl transition-colors border border-slate-700 disabled:opacity-50"
              >
                <ShieldCheck size={16} /> Delegate to Colleague
              </button>
            </>
          )}
          <button 
            onClick={() => router.push("/dashboard/audit")}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-blue-900/30"
          >
            Go to Audit <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}