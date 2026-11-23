"use client";

import { useState } from "react";
import { createClient } from "@/app/utils/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, Loader2, ArrowLeft, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row">
      {/* LEFT — Branding (desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-950 p-12 flex-col justify-between relative overflow-hidden border-r border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-900/20 rounded-full blur-3xl -ml-20 -mb-20"></div>

        <div className="relative z-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-12"
          >
            <ArrowLeft size={18} /> Back to Home
          </Link>
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center font-bold text-2xl text-white mb-8 shadow-lg shadow-blue-900/50">
            D&amp;S
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-6">
            Drive Impact.
            <br />
            Manage Partnerships.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              Achieve Goals.
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-md">
            The official Davis &amp; Shirtliff ESG &amp; Partnerships Department System.
            Audit-ready, seamless, and secure.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-sm text-slate-500">
          <ShieldCheck size={16} className="text-blue-500" /> Internal Use Only • Dayliff Accounts
        </div>
      </div>

      {/* RIGHT — Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 relative">
        {/* Mobile header */}
        <div className="lg:hidden w-full max-w-md mb-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 text-sm"
          >
            <ArrowLeft size={16} /> Back
          </Link>
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center font-bold text-xl text-white mx-auto mb-4 shadow-lg shadow-blue-900/50">
            D&amp;S
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
          <p className="text-slate-400 mt-1 text-sm">Sign in to ESG &amp; Partnerships System</p>
        </div>

        <div className="w-full max-w-md">
          <div className="hidden lg:block mb-10">
            <h2 className="text-3xl font-bold text-white">Sign In</h2>
            <p className="text-slate-400 mt-2">Enter your Dayliff credentials to access the system.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0"></div>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
              <div className="relative group">
                <Mail
                  className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-blue-500 transition-colors"
                  size={18}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                  placeholder="name@dayliff.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <div className="relative group">
                <Lock
                  className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-blue-500 transition-colors"
                  size={18}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center mt-8 disabled:opacity-50 shadow-lg shadow-blue-900/30"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Sign In to Dashboard"}
            </button>
          </form>

          <p className="text-center text-slate-500 text-xs mt-8">
            Having trouble logging in? Contact the System Administrator.
          </p>
        </div>
      </div>
    </div>
  );
}