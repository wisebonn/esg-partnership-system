import Link from "next/link";
import { ShieldCheck, ArrowRight, BarChart3, Users, Lock, FolderKanban, Sparkles } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col relative overflow-hidden">
      {/* Ambient background gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-900/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Navbar */}
      <nav className="w-full flex justify-between items-center p-6 border-b border-slate-800 relative z-10">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-900/50 group-hover:scale-105 transition-transform">
            D&S
          </div>
          <h1 className="text-xl font-semibold tracking-wide hidden md:block">
            ESG &amp; Partnerships
          </h1>
        </Link>
        <Link
          href="/login"
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-medium transition-all flex items-center gap-2 shadow-lg shadow-blue-900/30 hover:shadow-blue-900/60"
        >
          <Lock size={16} /> Secure Login
        </Link>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 relative z-10 py-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-6 text-sm font-medium">
          <Sparkles size={16} /> Internal Audit-Ready Platform
        </div>
        <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-3xl leading-tight mb-6">
          Drive Impact. Manage Partnerships.{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            Achieve Goals.
          </span>
        </h2>
        <p className="text-slate-400 max-w-2xl text-lg mb-10">
          The official Davis &amp; Shirtliff ESG &amp; Partnerships Department System.
          Seamlessly track project lifecycles, manage partner engagements, and ensure
          audit compliance in real-time.
        </p>

        <Link
          href="/login"
          className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-lg transition-all flex items-center gap-2 shadow-xl shadow-blue-900/40 hover:-translate-y-0.5 hover:shadow-blue-900/60 mb-16"
        >
          Access System <ArrowRight size={20} />
        </Link>

        {/* Feature Cards — all clickable, route to /login */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full text-left">
          <Link
            href="/login"
            className="group p-6 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:border-blue-500/50 hover:bg-slate-800/50 hover:-translate-y-1 transition-all cursor-pointer"
          >
            <BarChart3 className="text-blue-500 mb-4 group-hover:scale-110 transition-transform" size={28} />
            <h3 className="font-semibold text-lg mb-2 text-white">Real-Time Scoring</h3>
            <p className="text-sm text-slate-400">
              Track milestones against the annual plan with weighted scoring.
            </p>
          </Link>

          <Link
            href="/login"
            className="group p-6 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:border-blue-500/50 hover:bg-slate-800/50 hover:-translate-y-1 transition-all cursor-pointer"
          >
            <Users className="text-blue-500 mb-4 group-hover:scale-110 transition-transform" size={28} />
            <h3 className="font-semibold text-lg mb-2 text-white">Partner CRM</h3>
            <p className="text-sm text-slate-400">
              Centralized database for NGOs, corporate partners, and MoUs.
            </p>
          </Link>

          <Link
            href="/login"
            className="group p-6 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:border-blue-500/50 hover:bg-slate-800/50 hover:-translate-y-1 transition-all cursor-pointer"
          >
            <ShieldCheck className="text-blue-500 mb-4 group-hover:scale-110 transition-transform" size={28} />
            <h3 className="font-semibold text-lg mb-2 text-white">Audit Ready</h3>
            <p className="text-sm text-slate-400">
              Lock evidence, generate quarterly packs, and prevent greenwashing.
            </p>
          </Link>

          <Link
            href="/login"
            className="group p-6 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:border-blue-500/50 hover:bg-slate-800/50 hover:-translate-y-1 transition-all cursor-pointer md:col-span-3"
          >
            <FolderKanban className="text-blue-500 mb-4 group-hover:scale-110 transition-transform" size={28} />
            <h3 className="font-semibold text-lg mb-2 text-white">9-Step Project Lifecycle</h3>
            <p className="text-sm text-slate-400">
              From inception and MoU signing through commissioning and 3-month M&amp;E follow-ups — auto-generated workflows for every project.
            </p>
          </Link>
        </div>
      </main>

      <footer className="p-6 text-center text-slate-600 text-sm border-t border-slate-800 relative z-10">
        © Davis &amp; Shirtliff. Internal Use Only.
      </footer>
    </div>
  );
}