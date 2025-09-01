// src/components/Statistics.jsx
import React from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot,
} from "recharts";

/* ===== helpers ===== */
const n = (v, d = 0) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? d : Number(v);
const peso = (x) =>
  `₱${n(x).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pesoShort = (x) => {
  const v = Number(x || 0);
  if (v >= 1_000_000_000) return `₱${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `₱${(v / 1_000).toFixed(1)}k`;
  return `₱${v.toFixed(0)}`;
};

/* ===== tiny inline icons ===== */
const Icon = {
  Sales: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" {...p}>
      <path d="M4 20V8m6 12V4m6 16v-8" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  Warehouse: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" {...p}>
      <path d="M3 9l9-6 9 6v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 20v-8h10v8" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
};

/* ===== Card wrapper ===== */
const GlassCard = ({ title, icon, actions, children, className = "" }) => (
  <section
    className={[
      "rounded-2xl border bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60",
      "border-gray-200/70 shadow-sm hover:shadow-md transition-shadow p-4",
      className,
    ].join(" ")}
  >
    <header className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h2>
      </div>
      {actions}
    </header>
    <div className="min-h-[120px]">{children}</div>
  </section>
);

const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse rounded-md bg-slate-200/60 ${className}`} />
);

/* ===== chart helpers (exported getPeriodRange) ===== */
export const TZ = "Asia/Manila";
const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const labelDay = (d) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: TZ, month: "short", day: "2-digit" }).format(d);
const labelMonth = (d) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: TZ, month: "short" }).format(d);

const startOfWeek = (d) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0,0,0,0); return x; };
const endOfWeek = (d) => { const s = startOfWeek(d); const e = new Date(s); e.setDate(e.getDate()+6); e.setHours(23,59,59,999); return e; };
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
const startOfYear = (d) => new Date(d.getFullYear(), 0, 1);
const endOfYear = (d) => new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);

export function getPeriodRange(period, now = new Date()) {
  switch (period) {
    case "this-week": return { from: startOfWeek(now), to: endOfWeek(now), mode: "day" };
    case "prev-week": { const s = new Date(startOfWeek(now)); s.setDate(s.getDate() - 7); return { from: s, to: endOfWeek(s), mode: "day" }; }
    case "this-month": return { from: startOfMonth(now), to: endOfMonth(now), mode: "day" };
    case "prev-month": { const s = new Date(now.getFullYear(), now.getMonth()-1, 1); return { from: s, to: endOfMonth(s), mode: "day" }; }
    case "this-year": return { from: startOfYear(now), to: endOfYear(now), mode: "month" };
    case "prev-year": { const s = new Date(now.getFullYear()-1, 0, 1); return { from: s, to: endOfYear(s), mode: "month" }; }
    default: return { from: startOfMonth(now), to: endOfMonth(now), mode: "day" };
  }
}

function buildSeries(points = [], period = "this-week") {
  const { from, to, mode } = getPeriodRange(period);

  const buckets = new Map();
  if (mode === "day") {
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const k = startOfDay(d).toISOString();
      buckets.set(k, { x: labelDay(new Date(d)), y: 0 });
    }
  } else {
    for (let m = new Date(from.getFullYear(), from.getMonth(), 1); m <= to; m.setMonth(m.getMonth() + 1)) {
      const k = `${m.getFullYear()}-${m.getMonth()}`;
      buckets.set(k, { x: labelMonth(m), y: 0 });
    }
  }

  for (const p of points) {
    const d = new Date(p.date);
    if (d < from || d > to) continue;
    if (mode === "day") {
      const k = startOfDay(d).toISOString();
      const row = buckets.get(k);
      if (row) row.y += n(p.amount);
    } else {
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const row = buckets.get(k);
      if (row) row.y += n(p.amount);
    }
  }
  return Array.from(buckets.values());
}

const periodOptions = [
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "this-year", label: "This Year" },
  { value: "prev-week", label: "Previous Week" },
  { value: "prev-month", label: "Previous Month" },
  { value: "prev-year", label: "Previous Year" },
];

const MoneyTooltip = ({ active, payload, label }) =>
  active && payload && payload.length ? (
    <div className="rounded-md bg-white/95 px-2 py-1 text-xs shadow border">
      <div className="font-medium">{label}</div>
      <div className="text-red-600">{peso(payload[0].value)}</div>
    </div>
  ) : null;

/* ===== public component ===== */
export default function Statistics({
  metrics,
  salesPoints = [],
  onRefresh,
  loading,
  lastUpdated,
  className = "col-span-1 lg:col-span-3",
  period,                // controlled
  onPeriodChange,        // notify parent
}) {
  const [localPeriod, setLocalPeriod] = React.useState(period ?? "this-week");
  React.useEffect(() => { if (period) setLocalPeriod(period); }, [period]);

  const effectivePeriod = period ?? localPeriod;
  const data = React.useMemo(() => buildSeries(salesPoints, effectivePeriod), [salesPoints, effectivePeriod]);

  const maxY = React.useMemo(() => {
    const m = Math.max(0, ...data.map((d) => d.y));
    if (m === 0) return 1000;
    const pow = Math.pow(10, Math.floor(Math.log10(m)));
    return Math.ceil((m * 1.1) / pow) * pow;
  }, [data]);

  const headerActions = null;

  return (
    <GlassCard title="Statistics" icon={<Icon.Sales className="text-slate-500" />} actions={headerActions} className={className}>
      {!metrics ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 w-full gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full" />
          ))}
        </div>
      ) : (
        <div className="w-full">
          {/* revenue chart */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-700">Revenue</div>
              <select
                className="text-xs border rounded-md px-2 py-1 bg-white"
                value={effectivePeriod}
                onChange={(e) => {
                  const p = e.target.value;
                  setLocalPeriod(p);
                  onPeriodChange?.(p);
                }}
              >
                {periodOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="moneyRed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="x" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={pesoShort} width={60} domain={[0, maxY]} tick={{ fontSize: 11 }} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="y"
                    stroke="#ef4444"
                    fill="url(#moneyRed)"
                    strokeWidth={2}
                    dot={<Dot r={3} stroke="#ef4444" fill="#ef4444" />}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-end gap-2">
            <span className="inline-flex items-center gap-1"><Icon.Warehouse /> Last updated:</span>
            <time>{lastUpdated ? new Date(lastUpdated).toLocaleString() : "—"}</time>
          </div>
        </div>
      )}
    </GlassCard>
  );
}