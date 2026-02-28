// components/charts/SalesByRoutePie.jsx
import React, { useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import Empty from "../common/Empty";
import { peso } from "../../utils/formatters";

const COLORS = [
  "#4f46e5",
  "#22c55e",
  "#ef4444",
  "#f59e0b",
  "#06b6d4",
  "#8b5cf6",
  "#84cc16",
  "#e11d48",
  "#10b981",
];

const MAX_VISIBLE_ROUTES = 5;
const MIN_LABEL_SHARE = 0.08;

function pesoCompact(value) {
  const amount = Number(value) || 0;
  const abs = Math.abs(amount);

  if (abs >= 1_000_000_000) return `\u20B1${(amount / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `\u20B1${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `\u20B1${(amount / 1_000).toFixed(1)}K`;
  return `\u20B1${amount.toFixed(0)}`;
}

function sharePct(value, total) {
  if (!total) return 0;
  return (Number(value || 0) / total) * 100;
}

function renderSliceLabel({ percent, x, y }) {
  if (percent < MIN_LABEL_SHARE) return null;
  return (
    <text x={x} y={y} fontSize={12} fill="#334155" textAnchor="middle" dominantBaseline="central">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function SalesByRoutePie({ data = [] }) {
  const normalizedRows = useMemo(
    () =>
      (Array.isArray(data) ? data : [])
        .map((d) => ({
          name: (d?.name ?? "").toString().trim(),
          revenue: Number(d?.revenue ?? 0),
        }))
        .filter((d) => d.name && d.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue),
    [data]
  );

  const totalRevenue = useMemo(
    () => normalizedRows.reduce((sum, item) => sum + item.revenue, 0),
    [normalizedRows]
  );

  const topRoute = normalizedRows[0] || null;

  const chartData = useMemo(() => {
    if (!normalizedRows.length) return [];

    const primary = normalizedRows.slice(0, MAX_VISIBLE_ROUTES);
    const remaining = normalizedRows.slice(MAX_VISIBLE_ROUTES);
    const othersRevenue = remaining.reduce((sum, item) => sum + item.revenue, 0);

    if (othersRevenue <= 0) return primary;
    return [...primary, { name: "Others", revenue: othersRevenue, isOthers: true }];
  }, [normalizedRows]);

  if (!chartData.length) {
    return <Empty text="No route sales for the selected filters." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200 px-2.5 py-1 font-semibold">
          Top Route: {topRoute?.name || "--"}
        </span>
        <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200 px-2.5 py-1 font-semibold">
          Share: {sharePct(topRoute?.revenue || 0, totalRevenue).toFixed(1)}%
        </span>
        <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200 px-2.5 py-1 font-semibold">
          Total: {pesoCompact(totalRevenue)}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <div className="xl:col-span-2 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Pie
                data={chartData}
                dataKey="revenue"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={108}
                startAngle={90}
                endAngle={-270}
                paddingAngle={2}
                minAngle={5}
                label={renderSliceLabel}
                labelLine={false}
                isAnimationActive={false}
              >
                {chartData.map((item, index) => (
                  <Cell
                    key={`${item.name}-${index}`}
                    fill={item.isOthers ? "#94a3b8" : COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, _name, payload) => {
                  const routeName = payload?.payload?.name || "Route";
                  const revenue = Number(value || 0);
                  const percent = sharePct(revenue, totalRevenue).toFixed(1);
                  return [`${peso(revenue)} (${percent}%)`, routeName];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="xl:pt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300 mb-2">
            Route Breakdown
          </div>
          <div className="space-y-2">
            {chartData.map((item, index) => {
              const percent = sharePct(item.revenue, totalRevenue);
              return (
                <div key={`${item.name}-legend`} className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.isOthers ? "#94a3b8" : COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-200 truncate" title={item.name}>
                    {item.name}
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                    {pesoCompact(item.revenue)}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    ({percent.toFixed(1)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
