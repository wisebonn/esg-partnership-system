"use client";
import { useRealtimeSync } from "@/app/utils/useRealtime";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/app/utils/supabase";
import {
  LayoutDashboard, Target, FolderKanban, Users, CalendarCheck, ShieldCheck,
  LogOut, Menu, X, Settings, Globe, FileText
} from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Task Center & Annual Plan", href: "/dashboard/plan", icon: Target },
  { name: "Projects", href: "/dashboard/projects", icon: FolderKanban },
  { name: "Partners (CRM)", href: "/dashboard/partners", icon: Users },
  { name: "Meetings", href: "/dashboard/meetings", icon: CalendarCheck },
  { name: "Flagship Initiatives", href: "/dashboard/flagship", icon: Globe }, // <-- NEW LINK ADDED HERE
  { name: "Audit Center", href: "/dashboard/audit", icon: ShieldCheck },
  { name: "Monday Reports", href: "/dashboard/reports", icon: FileText },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 py-4 flex flex-col gap-2 px-2 overflow-y-auto">
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              isActive ? "bg-blue-600/10 text-blue-500" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <item.icon size={20} />
            <span className="font-medium">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useRealtimeSync();

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      setUserEmail(user?.email || null);
      
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
          
        if (data) {
          setUserRole(data.role);
        } else {
          setUserRole("staff");
        }
      } else {
        setUserRole(null);
      }
    };
    
    getUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-50 overflow-hidden">
      <aside className={`${isSidebarOpen ? "w-64" : "w-20"} bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col relative z-20`}>
        <div className="h-16 flex items-center justify-center border-b border-slate-800">
          <span className={`font-bold text-xl text-blue-500 ${!isSidebarOpen && "hidden"}`}>D&S ESG</span>
          {!isSidebarOpen && <span className="font-bold text-blue-500">D&S</span>}
        </div>

        <Suspense fallback={
          <div className="flex-1 py-4 flex flex-col gap-2 px-2">
            {navItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600">
                <item.icon size={20} />
                <span className="font-medium">Loading...</span>
              </div>
            ))}
          </div>
        }>
          <SidebarNav />
        </Suspense>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 text-slate-400 hover:text-red-400 transition-colors w-full px-3 py-2"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-10">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-400 hover:text-white">
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium text-white">{userEmail?.split("@")[0] || "Loading..."}</p>
              <p className="text-xs text-slate-400 capitalize">{userRole || "..."} • Dayliff</p>
            </div>
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-white uppercase">
              {userEmail?.charAt(0) || "U"}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
}