// src/components/Statistics.jsx - FIXED VERSION WITH CUSTOM DATE SUPPORT
import React from "react";
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
  ReferenceLine,
  Legend,
  LabelList,
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
  if (v <= -1_000_000_000) return `-₱${(Math.abs(v) / 1_000_000_000).toFixed(1)}B`;
  if (v <= -1_000_000) return `-₱${(Math.abs(v) / 1_000_000).toFixed(1)}M`;
  if (v <= -1_000) return `-₱${(Math.abs(v) / 1_000).toFixed(1)}k`;
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
      <path
        d="M3 9l9-6 9 6v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
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

/* ===== chart helpers ===== */
export const TZ = "Asia/Manila";
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const labelDay = (d) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: TZ, month: "short", day: "2-digit" }).format(d);
const labelMonth = (d) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: TZ, month: "short" }).format(d);

const startOfWeek = (d) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday start
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfWeek = (d) => {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
};
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
const startOfYear = (d) => new Date(d.getFullYear(), 0, 1);
const endOfYear = (d) => new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);

export function getPeriodRange(period, now = new Date()) {
  switch (period) {
    case "this-week":
      return { from: startOfWeek(now), to: endOfWeek(now), mode: "day" };
    case "prev-week": {
      const s = new Date(startOfWeek(now));
      s.setDate(s.getDate() - 7);
      return { from: s, to: endOfWeek(s), mode: "day" };
    }
    case "this-month":
      return { from: startOfMonth(now), to: endOfMonth(now), mode: "day" };
    case "prev-month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { from: s, to: endOfMonth(s), mode: "day" };
    }
    case "this-year":
      return { from: startOfYear(now), to: endOfYear(now), mode: "month" };
    case "prev-year": {
      const s = new Date(now.getFullYear() - 1, 0, 1);
      return { from: s, to: endOfYear(s), mode: "month" };
    }
    default:
      return { from: startOfMonth(now), to: endOfMonth(now), mode: "day" };
  }
}

// 🔧 NEW: Enhanced function to handle custom date ranges
export function getCustomPeriodRange(period, customStartDate = '', customEndDate = '', now = new Date()) {
  if (period === "custom" && customStartDate && customEndDate) {
    const from = new Date(customStartDate + "T00:00:00");
    const to = new Date(customEndDate + "T23:59:59");
    
    // Determine mode based on date range duration
    const diffDays = Math.ceil((to - from) / (1000 * 60 * 60 * 24));
    const mode = diffDays > 60 ? "month" : "day";
    
    return { from, to, mode };
  }
  return getPeriodRange(period, now);
}

/** 🔧 FIXED: Build canonical buckets for the selected period with custom date support */
function buildEmptyBuckets(period = "this-week", customStartDate = '', customEndDate = '') {
  // Use custom date range if period is "custom"
  let from, to, mode;
  
  if (period === "custom" && customStartDate && customEndDate) {
    from = new Date(customStartDate + "T00:00:00");
    to = new Date(customEndDate + "T23:59:59");
    // Determine mode based on date range duration
    const diffDays = Math.ceil((to - from) / (1000 * 60 * 60 * 24));
    mode = diffDays > 60 ? "month" : "day";
  } else {
    const range = getPeriodRange(period);
    from = range.from;
    to = range.to;
    mode = range.mode;
  }
  
  const map = new Map();

  if (mode === "day") {
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const key = startOfDay(d).toISOString();
      map.set(key, { key, x: labelDay(new Date(d)), revenue: 0, profit: 0 });
    }
  } else {
    for (let m = new Date(from.getFullYear(), from.getMonth(), 1); m <= to; m.setMonth(m.getMonth() + 1)) {
      const key = `${m.getFullYear()}-${m.getMonth()}`;
      map.set(key, { key, x: labelMonth(m), revenue: 0, profit: 0 });
    }
  }
  return { map, mode, from, to };
}

function bucketize(points = [], period = "this-week", field = "revenue", customStartDate = '', customEndDate = '') {
  const { map, mode, from, to } = buildEmptyBuckets(period, customStartDate, customEndDate);

  for (const p of points) {
    const d = new Date(p.date);
    if (isNaN(d)) continue;
    if (d < from || d > to) continue;

    const key = mode === "day" ? startOfDay(d).toISOString() : `${d.getFullYear()}-${d.getMonth()}`;
    const row = map.get(key);
    if (row) row[field] += n(p.amount);
  }

  return Array.from(map.values()).map((r) => ({
    x: r.x,
    revenue: r.revenue,
    profit: r.profit,
    profitPos: r.profit > 0 ? r.profit : null,
    profitNeg: r.profit < 0 ? r.profit : null,
  }));
}

function mergeRevenueProfit(revenuePoints = [], profitPoints = [], period = "this-week", customStartDate = '', customEndDate = '') {
  const base = bucketize(revenuePoints, period, "revenue", customStartDate, customEndDate);
  const profitBuckets = bucketize(profitPoints, period, "profit", customStartDate, customEndDate);

  return base.map((row, i) => {
    const profit = profitBuckets[i]?.profit ?? 0;
    return {
      x: row.x,
      revenue: row.revenue ?? 0,
      profit,
      profitPos: profit > 0 ? profit : null,
      profitNeg: profit < 0 ? profit : null,
    };
  });
}

/* ===== export period options for the Dashboard ===== */
export const periodOptions = [
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "this-year", label: "This Year" },
  { value: "prev-week", label: "Previous Week" },
  { value: "prev-month", label: "Previous Month" },
  { value: "prev-year", label: "Previous Year" },
];

export default function Statistics({
  metrics,
  salesPoints = [],
  profitPoints = [],
  lastUpdated,
  className = "col-span-1 lg:col-span-3",
  period = "this-week", // comes from Dashboard
  customStartDate = '', // 🔧 NEW: Add custom date support
  customEndDate = '', // 🔧 NEW: Add custom date support
  revenue = 0, // Pass the revenue here
}) {
  const data = React.useMemo(
    () => mergeRevenueProfit(salesPoints, profitPoints, period, customStartDate, customEndDate),
    [salesPoints, profitPoints, period, customStartDate, customEndDate]
  );

  const maxY = React.useMemo(() => {
    const m = Math.max(0, ...data.map((d) => Math.max(d.revenue ?? 0, d.profit ?? 0)));
    if (m === 0) return 1000;
    const pow = Math.pow(10, Math.floor(Math.log10(m)));
    return Math.ceil((m * 1.1) / pow) * pow;
  }, [data]);

  const minYRaw = React.useMemo(() => {
    const m = Math.min(0, ...data.map((d) => Math.min(d.revenue ?? 0, d.profit ?? 0)));
    if (m === 0) return 0;
    const abs = Math.abs(m);
    const pow = Math.pow(10, Math.floor(Math.log10(abs)));
    return -Math.ceil((abs * 1.1) / pow) * pow;
  }, [data]);

  const minY =
    minYRaw === 0 ? -Math.max(100, Math.round((Number.isFinite(maxY) ? maxY : 1000) * 0.05)) : minYRaw;

  const MoneyTooltip = ({ active, payload, label }) => {
    if (!active) return null;
    const row = payload?.[0]?.payload ?? null;
    if (!row) return null;
    return (
      <div className="rounded-md bg-white/95 px-2 py-1 text-xs shadow border space-y-0.5">
        <div className="font-medium">{label}</div>
        <div className="flex items-center gap-2 text-red-600">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Revenue: {peso(row.revenue ?? 0)}
        </div>
        <div className="flex items-center gap-2 text-emerald-600">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Profit: {peso(row.profit ?? 0)}
        </div>
      </div>
    );
  };

  // Find last profit point for a single floating label
  const lastProfitIndex = React.useMemo(() => {
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i]?.profit !== null && data[i]?.profit !== undefined) return i;
    }
    return -1;
  }, [data]);

  const ProfitEndLabel = ({ x, y, value, index }) => {
    if (index !== lastProfitIndex || value == null) return null;
    const text = `Profit: ${peso(value)}`;
    const dy = -10;
    const w = Math.max(40, text.length * 6.4);
    return (
      <g>
        <rect x={x - 6} y={y + dy - 14} rx="6" ry="6" width={w} height="18" fill="white" opacity="0.9" />
        <text x={x} y={y + dy} fontSize="11" fill="#0ea5e9" fontWeight="600">
          {text}
        </text>
      </g>
    );
  };

  return (
    <GlassCard title="Statistics" icon={<Icon.Sales className="text-slate-500" />} className={className}>
      {!metrics ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 w-full gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full" />
          ))}
        </div>
      ) : (
        <div className="w-full">
          {/* header area intentionally empty now (dropdown moved to Dashboard) */}
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                <defs>
                  {/* Revenue fill */}
                  <linearGradient id="moneyRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>

                  {/* Profit soft glow under the line */}
                  <linearGradient id="profitGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.16} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>

                  {/* Profit stroke gradient */}
                  <linearGradient id="profitStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#14b8a6" />
                  </linearGradient>

                  {/* Halo gradient */}
                  <linearGradient id="profitHaloGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.25" />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="x" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="left"
                  tickFormatter={pesoShort}
                  width={60}
                  domain={[minY, maxY]}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip content={<MoneyTooltip />} />
                <Legend verticalAlign="top" height={24} />
                <ReferenceLine y={0} yAxisId="left" stroke="#cbd5e1" strokeDasharray="3 3" />

                {/* Revenue area */}
                <Area
                  yAxisId="left"
                  type="monotone"
                  name="Revenue"
                  dataKey="revenue"
                  stroke="#ef4444"
                  fill="url(#moneyRed)"
                  strokeWidth={2}
                  dot={<Dot r={3} stroke="#ef4444" fill="#ef4444" />}
                  activeDot={{ r: 5 }}
                />

                {/* Profit glow underlay */}
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#profitGlow)"
                  isAnimationActive={false}
                  dot={<Dot r={3} stroke="#10b981" fill="#10b981" />}
                  activeDot={{ r: 5 }}
                />

                {/* POSITIVE PROFIT -- halo */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="profitPos"
                  stroke="url(#profitHaloGrad)"
                  strokeWidth={6}
                  strokeLinecap="round"
                  dot={false}
                  activeDot={false}
                  connectNulls
                />
                {/* POSITIVE PROFIT -- main stroke */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  name="Profit"
                  dataKey="profitPos"
                  stroke="url(#profitStrokeGrad)"
                  strokeWidth={4}
                  strokeLinecap="round"
                  dot={{ r: 5, stroke: "#fff", strokeWidth: 2, fill: "#10b981" }}
                  activeDot={{ r: 7, stroke: "#fff", strokeWidth: 2, fill: "#10b981" }}
                  connectNulls
                  legendType="line"
                >
                  <LabelList dataKey="profit" content={ProfitEndLabel} />
                </Line>

                {/* NEGATIVE PROFIT -- halo */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="profitNeg"
                  stroke="#ef4444"
                  strokeOpacity={0.25}
                  strokeWidth={6}
                  strokeLinecap="round"
                  dot={false}
                  activeDot={false}
                  connectNulls
                />
                {/* NEGATIVE PROFIT -- dashed */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="profitNeg"
                  stroke="#ef4444"
                  strokeWidth={4}
                  strokeDasharray="8 6"
                  strokeLinecap="round"
                  dot={{ r: 5, stroke: "#fff", strokeWidth: 2, fill: "#ef4444" }}
                  activeDot={{ r: 7, stroke: "#fff", strokeWidth: 2, fill: "#ef4444" }}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Total Revenue Display */}
          <div className="mt-4 text-[14px] text-slate-600">
            <strong>Total Revenue: {peso(revenue)}</strong> {/* Display total revenue */}
          </div>

          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-end gap-2">
            <span className="inline-flex items-center gap-1">
              <Icon.Warehouse /> Last updated:
            </span>
            <time>{lastUpdated ? new Date(lastUpdated).toLocaleString() : "--"}</time>
          </div>
        </div>
      )}
    </GlassCard>
  );
}