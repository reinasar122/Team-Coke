// components/charts/SalesByWarehouseBar.jsx
import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  Bar,
  CartesianGrid,
  Tooltip,
  LabelList,
  Cell,
} from "recharts";
import Empty from "../common/Empty";
import { peso } from "../../utils/formatters";

// Short peso for axes/labels (e.g., ₱32k, ₱1.2M)
function pesoShort(v) {
  if (v == null) return "";
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `₱${(v / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `₱${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `₱${(v / 1_000).toFixed(1)}k`;
  return `₱${Number(v).toFixed(0)}`;
}

// Palette
const PALETTE = [
  "#2563eb", "#22c55e", "#ef4444", "#f59e0b", "#06b6d4",
  "#8b5cf6", "#84cc16", "#e11d48", "#0ea5e9", "#f97316",
  "#14b8a6", "#94a3b8",
];

// stable string hash (djb2)
function hashString(str = "") {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
  return h | 0;
}

export default function SalesByWarehouseBar({ data = [], warehouses = [], focus = null }) {
  // Normalize & filter: real names only; option to whitelist when "All Warehouses"
  const rows = useMemo(() => {
    const whitelist = new Set((warehouses || []).filter(Boolean));
    return (Array.isArray(data) ? data : [])
      .map(d => ({ name: (d?.name ?? "").toString().trim(), revenue: Number(d?.revenue ?? 0) }))
      .filter(d => d.name && d.name !== "—" && d.revenue > 0)
      .filter(d => (whitelist.size > 0 ? whitelist.has(d.name) : true))
      .sort((a, b) => b.revenue - a.revenue);
  }, [data, warehouses]);

  // Build a color map with collision-avoidance so names never share a color in the same chart
  const colorMap = useMemo(() => {
    const used = new Set();
    const map = {};
    rows.forEach((r) => {
      let idx = Math.abs(hashString(r.name)) % PALETTE.length;
      let guard = 0;
      while (used.has(idx) && guard < PALETTE.length) {
        idx = (idx + 1) % PALETTE.length; // shift to next free color
        guard++;
      }
      used.add(idx);
      map[r.name] = PALETTE[idx];
    });
    return map;
  }, [rows]);

  if (!rows.length) {
    return <Empty text="No warehouse sales for the selected filters." />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={rows}
        margin={{ top: 10, right: 12, bottom: 10, left: 4 }}
        barCategoryGap={24}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tickMargin={8} interval={0} />
        <YAxis tickFormatter={pesoShort} width={58} domain={[0, "auto"]} />
        <Tooltip formatter={(value, _name, { payload }) => [peso(value), payload?.name || ""]} />
        <Bar dataKey="revenue" radius={[8, 8, 0, 0]} isAnimationActive={false}>
          <LabelList dataKey="revenue" position="top" formatter={pesoShort} fontSize={12} />
          {rows.map((r, i) => (
            <Cell
              key={i}
              fill={colorMap[r.name]}
              fillOpacity={focus && r.name !== focus ? 0.45 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}