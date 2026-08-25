import { useEffect, useMemo, useState } from "react";
import api from "../api"; // Import the API helper
import ProductBreakdownTable from "../components/tables/ProductBreakdownTable";

const SORTERS = {
  revenue: (r) => Number(r.revenue ?? 0),
  profit: (r) => Number(r.profit ?? 0),
  qty: (r) => Number(r.qty_sold ?? r.qty ?? 0),
  discount_rate: (r) => Number(r.discount_rate ?? 0),
  return_rate: (r) => Number(r.return_rate ?? 0),
};

export default function ProductBreakdownContainer({
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
  const [showFull, setShowFull] = useState(false); // Modal toggle state

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
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

        const urls = [
          `sales_report/`,
          `reports/sales/`,
        ];

        let data;
        let lastError;
        for (const url of urls) {
          try {
            console.log("[ProductBreakdown] GET:", url, params);
            const res = await api.get(url, { params, headers, timeout: 15000 });
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

        const products =
          data?.products ?? data?.product_breakdown ?? data?.rows ?? [];

        // --- Normalize rows (NOW includes discount_amount) ---
        let rows = products.map((p) => ({
          product_id:
            p.product_id ?? p.productId ?? (typeof p.product === "object" ? p.product?.id : undefined),
          product: p.product_name ?? p.product ?? "—",
          qty: Number(p.qty_sold ?? p.qty ?? 0),
          revenue: Number(p.revenue ?? p.net_revenue ?? 0),
          profit: Number(p.profit ?? p.revenue ?? 0),
          discount_amount: Number(p.discount_amount ?? 0),   // NEW: Track discount sum
          discount_rate: Number(p.discount_rate ?? 0),
          return_rate: Number(p.return_rate ?? 0),
          _raw: p,
        }));

        // 🧹 Filter out junk rows
        rows = rows.filter((r) => r.product && r.product.toLowerCase() !== "product");

        // --- Merge products when warehouse == "all" ---
        if (!warehouseId || warehouseId === "all") {
          const merged = new Map();
          for (const r of rows) {
            const key =
              r.product_id != null ? `id:${r.product_id}` : `name:${r.product}`;
            if (!merged.has(key)) {
              merged.set(key, {
                product_id: r.product_id,
                product: r.product,
                qty: 0,
                revenue: 0,
                profit: 0,
                discount_amount: 0, // Track sum of discounts
                _w_rev: 0,
                _sum_discount_rev: 0,
                _sum_return_rev: 0,
              });
            }
            const m = merged.get(key);
            m.qty += Number(r.qty || 0);
            m.revenue += Number(r.revenue || 0);
            m.profit += Number(r.profit || 0);
            m.discount_amount += Number(r.discount_amount || 0); // Sum discounts

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
            discount_amount: m.discount_amount, // Forward discount sum
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
  }, [warehouseId, routeId, period, start, end]);

  // 🔎 Apply search + sort + totals
  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? rawRows.filter((r) => (r.product || "").toLowerCase().includes(term))
      : rawRows.slice();

    const get = SORTERS[sortKey] ?? SORTERS.revenue;
    filtered.sort((a, b) => get(b) - get(a)); // Sorting in descending order

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

  const previewRows = useMemo(() => rows.slice(0, 10), [rows]);

  const onExportCSV = () => {
    if (!rows.length) return;
    const header = [
      "Product",
      "Qty Sold",
      "Revenue",
      "Profit",
      "Discount %",
      "Return Rate %",
    ];
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
    <>
      <ProductBreakdownTable
        loading={loading}
        rows={previewRows}
        query={query}
        sortKey={sortKey}
        onQuery={setQuery}
        onSort={setSortKey}
        onExportCSV={onExportCSV}
        error={err}
        totalCount={rows.length}
        isPreview
        onOpenFull={() => setShowFull(true)}
        variant="card"
      />

      {showFull && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-[94vw] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm md:text-base font-semibold text-slate-800">
                Full Product Breakdown
              </h3>
              <button
                onClick={() => setShowFull(false)}
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <span className="sr-only">Close</span>
                ✕
              </button>
            </div>
            <div className="p-4 flex-1 overflow-hidden">
              <ProductBreakdownTable
                loading={loading}
                rows={rows}
                query={query}
                sortKey={sortKey}
                onQuery={setQuery}
                onSort={setSortKey}
                onExportCSV={onExportCSV}
                error={err}
                totalCount={rows.length}
                isPreview={false}
                variant="modal"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function csvSafe(val) {
  const s = String(val ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fixed(n) {
  return Number(n ?? 0).toFixed(2);
}
