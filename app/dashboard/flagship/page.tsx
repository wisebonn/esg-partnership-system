"use client";

import { useState } from "react";
import { 
  Globe, Leaf, Droplets, ArrowRight, X, BarChart3, MapPin, 
  CheckCircle2, FileText, Zap, ShieldAlert, Sparkles, TrendingUp, DollarSign, Calculator, TreePine, Activity, ArrowLeft, LineChart
} from "lucide-react";

// --- Extended Demo Data ---
const PROGRAMS = [
  {
    id: "solar",
    title: "Solar Water Pumping",
    subtitle: "Clean Energy & Emissions Avoidance",
    icon: <Droplets size={32} className="text-blue-400" />,
    color: "from-blue-900/60 to-slate-900",
    accent: "bg-blue-500",
    textAccent: "text-blue-400",
    border: "border-blue-800/50",
    image: "https://images.unsplash.com/photo-1592833159155-c62df1b65634?q=80&w=1000&auto=format&fit=crop",
    description: "Replacing diesel and grid pumps with solar-powered water systems across commercial and CSR project sites.",
    target: 500,
    current: 145,
    unit: "Pumps Installed",
    impactStats: [
      { label: "Clean Energy", value: "1.2M kWh/yr" },
      { label: "CO2e Avoided", value: "3,800 Tons/yr" },
      { label: "Client Savings", value: "KES 27M/yr" }
    ],
    methodology: [
      { 
        title: "1. Daily Hydraulic Energy", 
        formula: "E_hyd (kWh/day) = (ρ × g × Q_day × TDH) / 3.6 × 10^6",
        desc: "ρ = 1000 kg/m³ (water density), g = 9.81 m/s², Q_day = Daily water volume (m³/day), TDH = Total Dynamic Head (m)."
      },
      { 
        title: "2. Annual Electrical Energy Generated", 
        formula: "E_elec (kWh/yr) = P_pump (kW) × PSH × 365 × CF_op",
        desc: "PSH = Peak Sun Hours (Default Kenya: 5.5 hrs/day). CF_op = Operational utilization factor (0.85)."
      },
      { 
        title: "3. KPLC Grid CO2e Avoided", 
        formula: "CO2e_grid (kg/yr) = E_elec × EF_KPLC",
        desc: "EF_KPLC (Kenya Grid Emission Factor) = 0.3174 kg CO2e/kWh (UNFCCC Combined Margin Baseline)."
      },
      { 
        title: "4. Financial Value Saved", 
        formula: "KES_saved_grid = E_elec × Tariff_KPLC",
        desc: "Tariff_KPLC = KES 22.50/kWh (blended commercial rate incl. levies & VAT)."
      }
    ]
  },
  {
    id: "trees",
    title: "One Project, One Grove",
    subtitle: "CSR Tree Growing & Biodiversity",
    icon: <TreePine size={32} className="text-emerald-400" />,
    color: "from-emerald-900/60 to-slate-900",
    accent: "bg-emerald-500",
    textAccent: "text-emerald-400",
    border: "border-emerald-800/50",
    image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=1000&auto=format&fit=crop",
    description: "Pairing every commissioned CSR water project with geo-tagged, irrigated indigenous & fruit tree groves tracked for 24-month survival.",
    target: 10000,
    current: 4200,
    unit: "Trees Planted",
    impactStats: [
      { label: "Survival Rate", value: "84% at 24 mo" },
      { label: "Land Restored", value: "100 Hectares" },
      { label: "Asset Value", value: "KES 4.2M/yr" }
    ],
    methodology: [
      { 
        title: "1. Site Seedling Quota", 
        formula: "N_target = Base_Quota (50) + [10 trees per kWp installed]",
        desc: "Minimum 50 trees per CSR site; scales automatically with the host solar system capacity."
      },
      { 
        title: "2. Survival Rate (SR)", 
        formula: "SR (%) = (N_alive_at_audit / N_planted_total) × 100",
        desc: "Target: ≥ 85% at Month 6; ≥ 80% at Month 12 & 24. Sites below 75% trigger mandatory gap-filling."
      },
      { 
        title: "3. Carbon Sequestration Estimate", 
        formula: "CO2_seq (kg/yr) = N_alive × R_species",
        desc: "R_species = 10 kg CO2/tree/yr (Years 1-3) and 22 kg CO2/tree/yr (Years 4+). Reported under GRI 304."
      },
      { 
        title: "4. Institutional Asset Value", 
        formula: "V_grove = N_fruit_alive × Yield_kg × Price_KES",
        desc: "Starting Year 3, generates recurring income/food value for the community (e.g., 50 mango trees × 40kg × KES 50)."
      }
    ]
  },
  {
    id: "paperless",
    title: "Paperless Operations",
    subtitle: "OpEx Recovery & Waste Reduction",
    icon: <FileText size={32} className="text-amber-400" />,
    color: "from-amber-900/60 to-slate-900",
    accent: "bg-amber-500",
    textAccent: "text-amber-400",
    border: "border-amber-800/50",
    image: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?q=80&w=1000&auto=format&fit=crop",
    description: "Eliminating avoidable office and field printing across workflows, funneling savings into the CSR Reserve.",
    target: 50000,
    current: 18500,
    unit: "Pages Avoided",
    impactStats: [
      { label: "Trees Saved", value: "12 Trees/yr" },
      { label: "Water Saved", value: "300k Liters/yr" },
      { label: "Reserve Funded", value: "KES 1.2M" }
    ],
    methodology: [
      { 
        title: "1. Pages Avoided", 
        formula: "Pages = Baseline_Print_Volume - Actual_Print_Volume",
        desc: "Tracked via eTIMS compliance, digital forms, and warehouse/engineering digital workflows."
      },
      { 
        title: "2. OpEx Saved (KES)", 
        formula: "OpEx_Saved = Pages_Avoided × (Paper + Toner + Maintenance)",
        desc: "Direct working capital recovery. 100% of this verified saving is ring-fenced for CSR."
      },
      { 
        title: "3. Waste Reduction (Kg)", 
        formula: "Waste_Saved = Pages_Avoided × Weight_per_Page",
        desc: "Reported under GRI 301 (Materials) and GRI 306 (Waste)."
      }
    ]
  }
];

export default function FlagshipProgramsPage() {
  const [selectedProgram, setSelectedProgram] = useState<typeof PROGRAMS[0] | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "dashboard" | "methodology">("overview");

  // Reset tab when opening a new program
  const handleOpenProgram = (prog: typeof PROGRAMS[0]) => {
    setSelectedProgram(prog);
    setActiveTab("overview");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Globe className="text-blue-500" size={32} /> Flagship ESG Initiatives
          </h1>
          <p className="text-slate-400 mt-1">A closed-loop system where internal cost savings fund external ecological restoration.</p>
        </div>
        <div className="bg-indigo-500/10 border border-indigo-500/30 px-4 py-2 rounded-xl flex items-center gap-2 text-indigo-300 text-sm font-medium shadow-lg shadow-indigo-900/20">
          <Sparkles size={16} /> Interactive Demo: Process & Formulas
        </div>
      </div>

      {/* Closed Loop Explanation */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-xl shadow-black/50">
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-lg font-semibold text-white mb-2">The Closed-Loop Financial Reconciliation</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            100% of verified OpEx savings reconciled under <strong className="text-amber-400">Pillar 3 (Paperless)</strong> are ring-fenced into the ESG CSR Reserve Ledger to co-fund seedlings, tree guards, and audits under <strong className="text-emerald-400">Pillar 2 (Trees)</strong>. Every shilling saved internally creates measurable environmental assets externally.
          </p>
        </div>
        <div className="flex gap-4 items-center text-slate-500 bg-slate-950 p-4 rounded-xl border border-slate-800">
          <FileText size={32} className="text-amber-400" />
          <ArrowRight size={24} className="text-slate-600" />
          <DollarSign size={32} className="text-slate-300" />
          <ArrowRight size={24} className="text-slate-600" />
          <TreePine size={32} className="text-emerald-400" />
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PROGRAMS.map((prog) => {
          const progressPercent = Math.round((prog.current / prog.target) * 100);
          
          return (
            <div 
              key={prog.id} 
              onClick={() => handleOpenProgram(prog)}
              className={`group cursor-pointer bg-gradient-to-b ${prog.color} border ${prog.border} rounded-3xl overflow-hidden hover:-translate-y-1 transition-all duration-300 shadow-xl`}
            >
              <div className="h-48 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent z-10"></div>
                <img src={prog.image} alt={prog.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute top-4 left-4 z-20 bg-slate-950/80 p-3 rounded-2xl backdrop-blur-md border border-slate-700">
                  {prog.icon}
                </div>
              </div>
              
              <div className="p-6 relative">
                <h2 className="text-xl font-bold text-white mb-1">{prog.title}</h2>
                <p className={`text-xs font-semibold mb-3 ${prog.textAccent}`}>{prog.subtitle}</p>
                <p className="text-sm text-slate-300 mb-6 line-clamp-2">{prog.description}</p>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
                    <span>{prog.current.toLocaleString()} / {prog.target.toLocaleString()} {prog.unit}</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${prog.accent}`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-6 flex items-center text-sm font-medium text-white group-hover:text-blue-400 transition-colors">
                  View Dashboard <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Modal (Multi-Page Dashboard) */}
      {selectedProgram && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-4">
                <div className={`p-3 bg-slate-900 rounded-xl border ${selectedProgram.border}`}>
                  {selectedProgram.icon}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedProgram.title}</h2>
                  <p className={`text-sm font-medium ${selectedProgram.textAccent}`}>{selectedProgram.subtitle}</p>
                </div>
              </div>
              <button onClick={() => setSelectedProgram(null)} className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex px-6 border-b border-slate-800 bg-slate-900/50">
              {(["overview", "dashboard", "methodology"] as const).map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 px-6 text-sm font-semibold capitalize border-b-2 transition-colors ${activeTab === tab ? `border-${selectedProgram.id === 'solar' ? 'blue' : selectedProgram.id === 'trees' ? 'emerald' : 'amber'}-500 text-white` : "border-transparent text-slate-400 hover:text-slate-200"}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Modal Content Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-900">
              
              {/* --- TAB: OVERVIEW --- */}
              {activeTab === "overview" && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <h3 className="text-xl font-bold text-white">Strategic Mandate</h3>
                      <p className="text-slate-300 leading-relaxed text-lg">
                        {selectedProgram.description}
                      </p>
                      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
                        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Core Impact Metrics</h4>
                        <div className="space-y-4">
                          {selectedProgram.impactStats.map((stat, i) => (
                            <div key={i} className="flex justify-between items-center border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                              <span className="text-slate-400">{stat.label}</span>
                              <span className={`text-lg font-bold ${selectedProgram.textAccent}`}>{stat.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl overflow-hidden h-64 md:h-auto border border-slate-800 shadow-2xl relative">
                      <img src={selectedProgram.image} alt="Overview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-60"></div>
                    </div>
                  </div>
                </div>
              )}

              {/* --- TAB: DASHBOARD --- */}
              {activeTab === "dashboard" && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  
                  {/* High-Level Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Total Achieved</p>
                      <p className="text-4xl font-bold text-white">{selectedProgram.current.toLocaleString()}</p>
                      <p className="text-sm text-slate-400 mt-1">{selectedProgram.unit}</p>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Target Goal</p>
                      <p className="text-4xl font-bold text-white">{selectedProgram.target.toLocaleString()}</p>
                      <p className="text-sm text-slate-400 mt-1">{selectedProgram.unit}</p>
                    </div>
                    <div className={`border rounded-2xl p-6 flex flex-col items-center justify-center text-center ${selectedProgram.border} bg-slate-950`}>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Completion</p>
                      <p className={`text-4xl font-bold ${selectedProgram.textAccent}`}>{Math.round((selectedProgram.current / selectedProgram.target) * 100)}%</p>
                      <p className="text-sm text-slate-400 mt-1">of Annual Target</p>
                    </div>
                  </div>

                  {/* Visualizations */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                      <h3 className="text-sm font-semibold text-white mb-6 flex items-center gap-2"><LineChart size={18}/> Monthly Progress Trend</h3>
                      <div className="h-56 flex items-end justify-between gap-3">
                        {[5, 15, 25, 40, 50, 75, 85, 100].map((val, i) => (
                           <div key={i} className="w-full bg-slate-800 rounded-t-md relative group hover:bg-slate-700 transition-colors">
                             <div className={`absolute bottom-0 w-full rounded-t-md ${selectedProgram.accent}`} style={{ height: `${val}%` }}></div>
                             <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                               {Math.round((val / 100) * selectedProgram.current)}
                             </div>
                           </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 mt-3 font-medium">
                        <span>W1</span><span>W2</span><span>W3</span><span>W4</span><span>W5</span><span>W6</span><span>W7</span><span>W8</span>
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><MapPin size={18}/> Geographic Distribution</h3>
                      <div className="absolute inset-0 opacity-20 bg-[url('https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/World_map_-_low_resolution.svg/1200px-World_map_-_low_resolution.svg.png')] bg-cover bg-center"></div>
                      <div className="absolute top-1/2 left-1/4 text-red-500 animate-pulse drop-shadow-lg"><MapPin size={28} /></div>
                      <div className="absolute top-1/3 right-1/4 text-red-500 animate-pulse drop-shadow-lg"><MapPin size={28} /></div>
                      <div className="absolute bottom-1/4 left-1/2 text-red-500 animate-pulse drop-shadow-lg"><MapPin size={28} /></div>
                      <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur border border-slate-700 px-4 py-2 rounded-lg text-sm text-white shadow-xl">
                        <span className="font-bold text-lg">3</span> Active Sites
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* --- TAB: METHODOLOGY --- */}
              {activeTab === "methodology" && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="bg-blue-500/10 border border-blue-500/30 p-6 rounded-2xl flex gap-4">
                    <Calculator className="text-blue-400 flex-shrink-0" size={24} />
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">Standardized Calculation Logic</h3>
                      <p className="text-sm text-blue-200/80 leading-relaxed">
                        To withstand third-party ESG audits and align with the GHG Protocol and IFRS S2, all data is calculated using strictly calibrated formulas. 
                        Every project tied to this pillar must input the required baseline metrics to automatically generate these outputs.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {selectedProgram.methodology.map((step, i) => (
                      <div key={i} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <h4 className="text-md font-semibold text-white flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs">{i+1}</span>
                          {step.title}
                        </h4>
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 overflow-x-auto">
                          <code className={`text-sm font-mono ${selectedProgram.textAccent}`}>
                            {step.formula}
                          </code>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
            
            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-800 bg-slate-950 flex justify-between items-center rounded-b-3xl">
              <p className="text-xs text-slate-500 flex items-center gap-2">
                <ShieldAlert size={14} className="text-amber-500" /> Demo Mode: Data visualization and formulas are static examples.
              </p>
              <button onClick={() => setSelectedProgram(null)} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors">
                Close Dashboard
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}