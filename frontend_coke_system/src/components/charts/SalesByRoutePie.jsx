// components/charts/SalesByRoutePie.jsx
import React, { useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { peso } from "../../utils/formatters"; // <-- use peso for tooltip formatting

const COLORS = ["#4f46e5","#22c55e","#ef4444","#f59e0b","#06b6d4","#8b5cf6","#84cc16","#e11d48","#10b981"];

const RAD = Math.PI / 180;

// Outside label that avoids overlapping the pie
function renderLabel({ name, percent, cx, cy, midAngle, outerRadius }) {
  // hide labels for tiny slices; they stay in legend + tooltip
  if (percent < 0.06) return null; // <6%
  const r = outerRadius + 18;      // label distance from pie
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  const p = (percent * 100).toFixed(1);
  return (
    <text
      x={x}
      y={y}
      fontSize={12}
      fill="#334155"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
    >
      {name} {p}%
    </text>
  );
}

export default function SalesByRoutePie({ data = [] }) {
  const chartData = useMemo(
    () =>
      (Array.isArray(data) ? data : [])
        .filter(d => d && d.name && d.revenue > 0)   // ensure only real routes
        .sort((a, b) => b.revenue - a.revenue),      // stable layout
    [data]
  );

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
        <Pie
          data={chartData}
          dataKey="revenue"
          nameKey="name"
          innerRadius={55}
          outerRadius={85}
          startAngle={90}
          endAngle={-270}
          paddingAngle={1}
          minAngle={6}          // ensures skinny slices still get space
          label={renderLabel}   // custom outside labels
          labelLine
          isAnimationActive={false}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>

        <Tooltip
          formatter={(value, _name, { payload }) => {
            // Use peso() to format with currency symbol + thousand separators
            try {
              return [peso(Number(value)), payload?.name || ""];
            } catch {
              return [String(value), payload?.name || ""];
            }
          }}
        />
        <Legend verticalAlign="bottom" height={28} />
      </PieChart>
    </ResponsiveContainer>
  );
}