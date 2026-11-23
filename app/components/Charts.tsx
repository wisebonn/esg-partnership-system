"use client";

export function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let currentAngle = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-32 h-32 shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {total === 0 ? (
            <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="20" />
          ) : (
            data.map((d, i) => {
              const angle = (d.value / total) * 360;
              const strokeDasharray = `${(angle / 360) * 251.2} 251.2`;
              const strokeDashoffset = -((currentAngle / 360) * 251.2);
              currentAngle += angle;
              return (
                <circle
                  key={i}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={d.color}
                  strokeWidth="20"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                />
              );
            })
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{total}</span>
          <span className="text-[10px] text-slate-400 uppercase">Total</span>
        </div>
      </div>
      <div className="space-y-2 flex-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-slate-300">{d.label}</span>
            </div>
            <span className="font-medium text-white">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-300">{d.label}</span>
            <span className="text-white font-medium">{d.value}</span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full" 
              style={{ width: `${(d.value / max) * 100}%` }} 
            />
          </div>
        </div>
      ))}
    </div>
  );
}