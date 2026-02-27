// Updated ProductPerformance component with custom date support
import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

/* ---------------- helpers ---------------- */
const n = (v, d = 0) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? d : Number(v);
const peso = (x) =>
  `₱${n(x).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ---- period helpers (same semantics as Statistics) ---- */
const TZ = "Asia/Manila";
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const labelDay = (d) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: TZ, month: "short", day: "2-digit" }).format(d);
const startOfWeek = (d) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday=0
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

function getPeriodRange(period, now = new Date()) {
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
function getCustomPeriodRange(period, customStartDate = '', customEndDate = '', now = new Date()) {
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

/* ---- colors ---- */
const COLORS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#f59e42",
  "#a855f7",
  "#eab308",
  "#06b6d4",
  "#f97316",
];

/**
 * props.data: [{ date: 'YYYY-MM-DD', Coke: 1234, Sprite: 500, ... }, ...]
 * props.categoryMap?: { [productName: string]: categoryName }
 * props.categoryResolver?: (productName: string) => categoryName
 *
 * The component will use categoryMap first; if not found, falls back to categoryResolver;
 * if still unknown, uses "Uncategorized".
 */
export default function ProductPerformance({
  title = "Product Performance",
  data = [],
  height = 300,
  smooth = false,
  period = "this-week", // controlled by parent (shared with <Statistics/>)
  customStartDate = '', // 🔧 NEW: Add custom date support
  customEndDate = '', // 🔧 NEW: Add custom date support
  categoryMap = undefined,
  categoryResolver = undefined,
  topK = 3,
}) {
  const ProductTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    const rows = payload
      .filter((item) => item && item.value != null)
      .sort((a, b) => n(b?.value) - n(a?.value));
    if (!rows.length) return null;

    return (
      <div
        id="product-performance-tooltip"
        className="rounded-md px-2 py-1 text-xs shadow border space-y-1"
        style={{
          background: "#ffffff",
          color: "#0f172a",
          borderColor: "#e2e8f0",
          opacity: 1,
        }}
      >
        <div className="product-performance-tooltip-label font-medium" style={{ color: "#0f172a" }}>
          {label}
        </div>
        {rows.map((item) => (
          <div
            key={item.dataKey || item.name}
            className="product-performance-tooltip-row flex items-center gap-2"
            style={{
              color: item.color || item.stroke || "#64748b",
              "--product-tooltip-row-color": item.color || item.stroke || "#64748b",
            }}
          >
            <span
              className="product-performance-tooltip-dot h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color || item.stroke || "#64748b" }}
            />
            <span className="product-performance-tooltip-row-text">
              {item.name}: {peso(item.value ?? 0)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const src = Array.isArray(data) && data.length > 0 ? data : [];

  // 🛠️ FIX 1: Build productKeys as a UNION across ALL rows (not just the first row)
  const productKeys = React.useMemo(() => {
    const set = new Set();
    for (const row of src) {
      Object.keys(row).forEach((k) => {
        if (k !== "date" && k !== "x") set.add(k);
      });
    }
    return Array.from(set);
  }, [src]);

  // 🛠️ FIX 2: Add getCategoryFor function at the top
  const getCategoryFor = React.useCallback(
    (productName) => {
      if (categoryMap && categoryMap[productName]) return categoryMap[productName];
      if (categoryResolver) return categoryResolver(productName);
      return "Uncategorized";
    },
    [categoryMap, categoryResolver]
  );

  // 🔧 FIXED: Bucket to selected period and ensure x labels with custom date support
  const chartData = React.useMemo(() => {
    const { from, to, mode } = getCustomPeriodRange(period, customStartDate, customEndDate);
    const buckets = [];

    if (mode === "day") {
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const label = labelDay(new Date(d));
        const obj = { x: label };
        productKeys.forEach((k) => (obj[k] = 0));
        buckets.push({ key: startOfDay(d).toISOString().slice(0, 10), row: obj });
      }
    } else {
      for (let m = new Date(from.getFullYear(), from.getMonth(), 1); m <= to; m.setMonth(m.getMonth() + 1)) {
        const label = new Intl.DateTimeFormat("en-PH", { timeZone: TZ, month: "short" }).format(m);
        const obj = { x: label };
        productKeys.forEach((k) => (obj[k] = 0));
        buckets.push({
          key: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`,
          row: obj,
        });
      }
    }

    const byKey = new Map(buckets.map((b) => [b.key, b.row]));
    src.forEach((r) => {
      if (!r.date) return;
      const d = new Date(r.date);
      const k =
        mode === "day"
          ? startOfDay(d).toISOString().slice(0, 10)
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = byKey.get(k);
      if (!bucket) return;
      productKeys.forEach((p) => {
        bucket[p] += n(r[p]);
      });
    });

    return buckets.map((b) => b.row);
  }, [src, productKeys, period, customStartDate, customEndDate]);

  // 🛠️ FIX 3: Category chart data
  const categoryChartData = React.useMemo(() => {
    return chartData.map((row) => {
      const catRow = { x: row.x };
      productKeys.forEach((prod) => {
        const cat = getCategoryFor(prod);
        catRow[cat] = (catRow[cat] || 0) + n(row[prod]);
      });
      return catRow;
    });
  }, [chartData, productKeys, getCategoryFor]);

  const categoryKeys = React.useMemo(() => {
    const set = new Set();
    categoryChartData.forEach((row) => {
      Object.keys(row).forEach((k) => {
        if (k !== "x") set.add(k);
      });
    });
    return Array.from(set);
  }, [categoryChartData]);

  const { topCategoriesList, sortedCategoryKeys } = React.useMemo(() => {
    const totals = {};
    categoryChartData.forEach((row) => {
      categoryKeys.forEach((cat) => {
        totals[cat] = (totals[cat] || 0) + n(row[cat]);
      });
    });

    const sorted = Object.entries(totals)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    return {
      topCategoriesList: sorted.slice(0, Math.max(1, topK)),
      sortedCategoryKeys: sorted.map(({ category }) => category),
    };
  }, [categoryChartData, categoryKeys, topK]);

  return (
    <div
      className={[
        "w-full rounded-2xl p-4",
        "border bg-white/70 dark:bg-slate-900/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-900/70",
        "border-gray-200/70 dark:border-slate-700/70 shadow-sm hover:shadow-md transition-shadow",
      ].join(" ")}
    >
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>

      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <LineChart data={categoryChartData} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#cbd5e1" strokeOpacity={0.95} strokeDasharray="3 6" />
            <XAxis
              dataKey="x"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={{ stroke: "#cbd5e1" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v) => `₱${n(v).toLocaleString("en-PH")}`}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              width={78}
              tickLine={false}
              axisLine={{ stroke: "#cbd5e1" }}
            />
            <Tooltip
              content={<ProductTooltip />}
              isAnimationActive={false}
              wrapperStyle={{ opacity: 1, zIndex: 50 }}
            />
            {sortedCategoryKeys.map((cat, idx) => (
              <Line
                key={cat}
                type={smooth ? "monotone" : "linear"}
                dataKey={cat}
                stroke={COLORS[idx % COLORS.length]}
                strokeWidth={2}
                dot={{
                  r: 3,
                  strokeWidth: 2,
                  stroke: "#ffffff",
                  fill: COLORS[idx % COLORS.length],
                }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
