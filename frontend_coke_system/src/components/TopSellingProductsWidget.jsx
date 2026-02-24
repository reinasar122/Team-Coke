
// src/components/TopSellingProductsWidget.jsx
import React from "react";

/* helpers */
const n = (v, d = 0) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? d : Number(v);
const peso = (x) =>
  `₱${n(x).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* period helpers (aligned with your charts) */
const TZ = "Asia/Manila";
const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const startOfWeek = (d) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0,0,0,0); return x; };
const endOfWeek   = (d) => { const s = startOfWeek(d); const e = new Date(s); e.setDate(e.getDate()+6); e.setHours(23,59,59,999); return e; };
const startOfMonth= (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth  = (d) => new Date(d.getFullYear(), d.getMonth()+1, 0, 23, 59, 59, 999);
const startOfYear = (d) => new Date(d.getFullYear(), 0, 1);
const endOfYear   = (d) => new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);

function getPeriodRange(period, now = new Date()) {
  switch (period) {
    case "this-week":  return { from: startOfWeek(now),  to: endOfWeek(now)   };
    case "prev-week":  { const s = new Date(startOfWeek(now)); s.setDate(s.getDate()-7); return { from: s, to: endOfWeek(s) }; }
    case "this-month": return { from: startOfMonth(now), to: endOfMonth(now)  };
    case "prev-month": { const s = new Date(now.getFullYear(), now.getMonth()-1, 1); return { from: s, to: endOfMonth(s) }; }
    case "this-year":  return { from: startOfYear(now),  to: endOfYear(now)   };
    case "prev-year":  { const s = new Date(now.getFullYear()-1, 0, 1); return { from: s, to: endOfYear(s) }; }
    default:           return { from: startOfMonth(now), to: endOfMonth(now)  };
  }
}

/**
 * Props:
 * - title?: string
 * - series: [{ date:'YYYY-MM-DD', 'Coke 1L': 1234, 'Sprite 500ml': 800, ... }, ...]
 * - period: 'this-week' | 'prev-week' | 'this-month' | 'prev-month' | 'this-year' | 'prev-year'
 * - topN?: number
 */
export default function TopSellingProductsWidget({
  title = "🔥 Top Selling Products",
  series = [],
  period = "this-week",
  topN = 10,
}) {
  const { from, to } = React.useMemo(() => getPeriodRange(period), [period]);

  const rows = React.useMemo(() => {
    const totals = {};
    for (const row of Array.isArray(series) ? series : []) {
      const d = row?.date ? new Date(row.date) : null;
      if (!d || d < from || d > to) continue;
      for (const [key, val] of Object.entries(row)) {
        if (key === "date" || key === "x") continue;
        const v = Number(val || 0);
        if (!Number.isFinite(v)) continue;
        totals[key] = (totals[key] || 0) + v;
      }
    }
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value: n(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, Math.max(1, topN));
  }, [series, from, to, topN]);

  return (
    <div
      className={[
        "w-full rounded-2xl p-4",
        "border bg-white/70 dark:bg-slate-900/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-900/70",
        "border-gray-200/70 dark:border-slate-700/70 shadow-sm hover:shadow-md transition-shadow",
      ].join(" ")}
    >
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
      {!series || series.length === 0 ? (
        <div className="text-xs text-slate-500 dark:text-slate-300">No product sales data.</div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-slate-500 dark:text-slate-300">No sales for the selected period.</div>
      ) : (
        <ul className="text-xs text-slate-700 dark:text-slate-200 divide-y divide-slate-200 dark:divide-slate-700">
          {rows.map((r, i) => (
            <li key={r.name} className="py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="top-selling-rank-badge px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold w-10 text-center border border-transparent dark:border-slate-600">
                  {i + 1}
                </span>
                <span className="font-medium truncate max-w-[180px]" title={r.name}>
                  {r.name}
                </span>
              </div>
              <span className="top-selling-value text-red-600 dark:text-red-600 font-semibold">{peso(r.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
