import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import ProductBreakdownTable from "../components/tables/ProductBreakdownTable";

const SORTERS = {
  revenue: (r) => Number(r.revenue ?? 0),
  profit: (r) => Number(r.profit ?? 0),
  qty: (r) => Number(r.qty_sold ?? r.qty ?? 0),
  discount_rate: (r) => Number(r.discount_rate ?? 0),
  return_rate: (r) => Number(r.return_rate ?? 0),
};

export default function ProductBreakdownContainer({
  apiBase = "http://localhost:8080",
  warehouseId = "all",
  routeId = "all",
  period = "this_week",
  start,
  end,
  onTotalsChange,
}) {
  const [loading, setLoading] = useState(false);
  const [rawRows, setRawRows] = useState([]);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("revenue");
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        // ✅ Always send warehouse_id and route_id (use "all" when not filtered)
        const params = {
          warehouse_id: String(warehouseId ?? "all"),
          route_id: String(routeId ?? "all"),
          period: period ?? "this_week",
        };
        if (period === "custom") {
          if (start) params.start = start;
          if (end) params.end = end;
        }

        const token = localStorage.getItem("token");
        const headers = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        // ✅ Prefer the fixed endpoint first; fallback to legacy
        const urls = [
          `${apiBase}/api/sales_report/`,
          `${apiBase}/api/reports/sales/`,
        ];

        let data;
        let lastError;
        for (const url of urls) {
          try {
            // eslint-disable-next-line no-console
            console.log("[ProductBreakdown] GET:", url, params);
            const res = await axios.get(url, { params, headers, timeout: 15000 });
            data = res.data;
            break;
          } catch (e) {
            lastError = e;
          }
        }
        if (!data) {
          throw new Error(
            lastError?.response?.data?.detail ||
              lastError?.message ||
              "Failed to fetch product breakdown"
          );
        }

        const products = data?.products ?? data?.product_breakdown ?? data?.rows ?? [];

        // --- Normalize rows
        // --- Normalize rows
        let rows = products.map((p) => ({
          product_id:
            p.product_id ??
            p.productId ??
            (typeof p.product === "object" ? p.product?.id : undefined),
          product: p.product_name ?? p.product ?? "—",
          qty: Number(p.qty_sold ?? p.qty ?? 0),
          revenue: Number(p.revenue ?? p.net_revenue ?? 0),
          profit: Number(p.profit ?? p.revenue ?? 0),
          discount_rate: Number(p.discount_rate ?? 0),
          return_rate: Number(p.return_rate ?? 0),
          _raw: p,
        }));

        // 🧹 Filter out junk rows
        rows = rows.filter(
          (r) => r.product && r.product.toLowerCase() !== "product"
        );


        // --- If "All Warehouses" -> merge duplicates by product (sum qty/revenue/profit)
        if (!warehouseId || warehouseId === "all") {
          const merged = new Map();
          for (const r of rows) {
            const key = r.product_id != null ? `id:${r.product_id}` : `name:${r.product}`;
            if (!merged.has(key)) {
              merged.set(key, {
                product_id: r.product_id,
                product: r.product,
                qty: 0,
                revenue: 0,
                profit: 0,
                _w_rev: 0,
                _sum_discount_rev: 0,
                _sum_return_rev: 0,
              });
            }
            const m = merged.get(key);
            m.qty += Number(r.qty || 0);
            m.revenue += Number(r.revenue || 0);
            m.profit += Number(r.profit || 0);
            const rev = Number(r.revenue || 0);
            m._w_rev += rev;
            m._sum_discount_rev += rev * Number(r.discount_rate || 0);
            m._sum_return_rev += rev * Number(r.return_rate || 0);
          }
          rows = Array.from(merged.values()).map((m) => ({
            product_id: m.product_id,
            product: m.product,
            qty: m.qty,
            revenue: m.revenue,
            profit: m.profit,
            discount_rate: m._w_rev ? m._sum_discount_rev / m._w_rev : 0,
            return_rate: m._w_rev ? m._sum_return_rev / m._w_rev : 0,
          }));
        }

        if (!cancelled) setRawRows(rows);
      } catch (e) {
        console.error("[ProductBreakdown] load error:", e);
        if (!cancelled) {
          setErr(typeof e?.message === "string" ? e.message : "Load error");
          setRawRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, warehouseId, routeId, period, start, end]);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? rawRows.filter((r) => (r.product || "").toLowerCase().includes(term))
      : rawRows.slice();

    const get = SORTERS[sortKey] ?? SORTERS.revenue;
    filtered.sort((a, b) => get(b) - get(a)); // desc

    const totals = filtered.reduce(
      (acc, r) => {
        acc.units += Number(r.qty ?? 0);
        acc.revenue += Number(r.revenue ?? 0);
        acc.profit += Number(r.profit ?? 0);
        return acc;
      },
      { units: 0, revenue: 0, profit: 0 }
    );
    onTotalsChange?.(totals);

    return filtered;
  }, [rawRows, query, sortKey, onTotalsChange]);

  const onExportCSV = () => {
    if (!rows.length) return;
    const header = ["Product", "Qty Sold", "Revenue", "Profit", "Discount %", "Return Rate %"];
    const body = rows.map((r) => [
      csvSafe(r.product),
      r.qty,
      fixed(r.revenue),
      fixed(r.profit),
      fixed((r.discount_rate ?? 0) * 100),
      fixed((r.return_rate ?? 0) * 100),
    ]);
    const csv = [header, ...body].map((arr) => arr.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product_breakdown.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ProductBreakdownTable
      loading={loading}
      rows={rows}
      query={query}
      sortKey={sortKey}
      onQuery={setQuery}
      onSort={setSortKey}
      onExportCSV={onExportCSV}
      error={err}
    />
  );
}

function csvSafe(val) {
  const s = String(val ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function fixed(n) {
  return Number(n ?? 0).toFixed(2);
}