import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

// ✅ FIXED PATHS (go up two levels)
import Card from "../../components/common/Card";
import Metric from "../../components/common/Metric";
import ProductBreakdownTable from "../../components/tables/ProductBreakdownTable";
import SalesByRoutePie from "../../components/charts/SalesByRoutePie";
import SalesByWarehouseBar from "../../components/charts/SalesByWarehouseBar";
import Empty from "../../components/common/Empty";
import { n, peso, pct } from "../../utils/formatters";

// CRA/Webpack safe: use REACT_APP_ prefix
const API = process.env.REACT_APP_API_URL || "http://localhost:8080/api";

const toCSV = (rows, headers) => {
  const head = headers.map((h) => `"${h.label}"`).join(",");
  const body = rows
    .map((r) =>
      headers
        .map((h) => `"${(r[h.key] ?? "").toString().replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");
  return `${head}\n${body}`;
};

const saveFile = (filename, content, mime = "text/csv;charset=utf-8;") => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export default function SalesReport() {
  const [warehouses, setWarehouses] = useState([]);
  const [routes, setRoutes] = useState([]);

  const [filters, setFilters] = useState({
    warehouse: "all",
    route: "all",
    period: "this_week",
    start: null,
    end: null,
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState({
    summary: { total_revenue: 0, net_profit: 0, discounts: 0, return_rate: 0 },
    product_breakdown: [],
    sales_by_route: [],
    sales_by_warehouse: [],
    returns_block: { expected_sale: 0, actual_sale: 0, difference: 0, supplier_returnables: 0 },
    misc_expenses: [],
  });

  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState("revenue");
  const printRef = useRef(null);

  // --- helpers for date params (Manila-friendly YYYY-MM-DD) --- Kath
  // Convert Date to ISO string (YYYY-MM-DD) in local timezone
  // https://stackoverflow.com/a/23593052
  const toISO = (d) => {
    const dt = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return dt.toISOString().slice(0, 10);
  };

  const resolveRange = ({ period, start, end }) => {
    if (period === "custom" && start && end) return { startISO: start, endISO: end };

    const now = new Date();
    if (period === "this_week") {
      // Monday as start of week
      const dow = (now.getDay() + 6) % 7; // 0=Mon ... 6=Sun
      const monday = new Date(now);
      monday.setDate(now.getDate() - dow);
      return { startISO: toISO(monday), endISO: toISO(now) };
    }

    // default: this_month
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startISO: toISO(first), endISO: toISO(now) };
  };
  // --- end helpers ---: Kath

  /* Filters bootstrap */
  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const [wh, rt] = await Promise.allSettled([
          axios.get(`${API}/warehouses/`),
          axios.get(`${API}/routes/`),
        ]);
        if (!ok) return;
        setWarehouses(wh.status === "fulfilled" ? wh.value.data : []);
        setRoutes(rt.status === "fulfilled" ? rt.value.data : []);
      } catch {}
    })();
    return () => (ok = false);
  }, []);

  /* Fetch report */
  useEffect(() => {
    let ok = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const params = new URLSearchParams();
        if (filters.warehouse !== "all") params.set("warehouse_id", filters.warehouse);
        if (filters.route !== "all") params.set("route_id", filters.route);
        params.set("period", filters.period);
        if (filters.period === "custom") {
          if (filters.start) params.set("start", filters.start);
          if (filters.end) params.set("end", filters.end);
        }

        // 🔐 headers (only add Authorization if token exists)
        const token = localStorage.getItem("token");
        const headers = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        // 🌐 Try common endpoints (first one that succeeds wins)
        const endpoints = [
          `${API}/reports/sales/?${params.toString()}`,  // recommended new endpoint
          `${API}/sales_report/?${params.toString()}`,   // legacy alias, if added
        ];

        // let res;
        // let lastErr;
        // for (const url of endpoints) {
        //   try {
        //     console.log("[SalesReport] GET:", url);
        //     res = await axios.get(url, { headers, timeout: 15000 });
        //     break; // success
        //   } catch (e) {
        //     lastErr = e;
        //     console.warn("[SalesReport] failed:", url, e?.message);
        //   }
        // }
        // if (!res) {
        //   const status = lastErr?.response?.status;
        //   const detail =
        //     lastErr?.response?.data?.detail ||
        //     lastErr?.response?.data?.message ||
        //     lastErr?.message ||
        //     "Network error";
        //   throw new Error(status ? `HTTP ${status}: ${detail}` : `Network/CORS: ${detail}`);
        // }
        // 1) Fetch your existing (full) sales report first (as you already do)
        let res; //Kath
        let lastErr;
        for (const url of endpoints) {
          try {
            console.log("[SalesReport] GET:", url);
            res = await axios.get(url, { headers, timeout: 15000 });
            break; // success
          } catch (e) {
            lastErr = e;
            console.warn("[SalesReport] failed:", url, e?.message);
          }
        }
        if (!res) {
          const status = lastErr?.response?.status;
          const detail =
            lastErr?.response?.data?.detail ||
            lastErr?.response?.data?.message ||
            lastErr?.message ||
            "Network error";
          throw new Error(status ? `HTTP ${status}: ${detail}` : `Network/CORS: ${detail}`);
        }

        // 2) Compute date range for revenue-summary
        // after: const { startISO, endISO } = resolveRange(filters);
        const { startISO, endISO } = resolveRange(filters);

        // ✅ build params for revenue-summary (include filters)
        const revParams = {
          start: startISO,
          end: endISO,
        };
        if (filters.warehouse !== "all") revParams.warehouse_id = filters.warehouse;
        if (filters.route !== "all") revParams.route_id = filters.route;

        // (optional) quick debug in Django console
        // revParams.debug = 1;

        let rev = { gross_revenue: 0, discounts: 0, net_revenue: 0 };
        try {
          const revRes = await axios.get(`${API}/reports/revenue-summary/`, {
            headers,
            params: revParams,            // 👈 send the params
            timeout: 15000,
          });
          rev = revRes.data || rev;
          console.log("[SalesReport] revenue-summary params:", revParams);
        } catch (e) {
          console.warn("[SalesReport] revenue-summary failed:", e?.message);
        }
         // kath

        let retanddisc = { expected_sale: 0, actual_sale: 0, difference: 0, supplier_returnables: 0 };

        try {
          const retRes = await axios.get(`${API}/reports/returns-and-discrepancies/`, {
            headers,
            params: retanddisc,
            timeout: 15000,
          });
          retanddisc = retRes.data || retanddisc;
          console.log("[SalesReport] returns-and-discrepancies params:", retanddisc);
        } catch (e) {
          console.warn("[SalesReport] returns-and-discrepancies failed:", e?.message);
        }

        // if (!ok) return;
        // const r = res.data || {};
        // setData({
        //   summary: {
        //     total_revenue: n(r?.summary?.total_revenue),
        //     net_profit: n(r?.summary?.net_profit),
        //     discounts: n(r?.summary?.discounts),
        //     return_rate: n(r?.summary?.return_rate),
        //   },
        //   product_breakdown: Array.isArray(r?.products)
        //     ? r.products.map((p) => ({
        //         product: p.product_name ?? p.product ?? "—",
        //         qty: n(p.qty_sold),
        //         revenue: n(p.revenue),
        //         profit: n(p.profit),
        //         discount_rate: n(p.discount_rate),
        //         return_rate: n(p.return_rate),
        //       }))
        //     : [],
        //   sales_by_route: Array.isArray(r?.by_route)
        //     ? r.by_route.map((x) => ({ name: x.route ?? x.name, revenue: n(x.revenue) }))
        //     : [],
        //   sales_by_warehouse: Array.isArray(r?.by_warehouse)
        //     ? r.by_warehouse.map((x) => ({ name: x.warehouse ?? x.name, revenue: n(x.revenue) }))
        //     : [],
        //   returns_block: {
        //     expected_sale: n(r?.returns?.expected_sale),
        //     actual_sale: n(r?.returns?.actual_sale),
        //     difference: n(r?.returns?.difference),
        //     supplier_returnables: n(r?.returns?.supplier_returnables),
        //   },
        //   misc_expenses: Array.isArray(r?.misc_expenses)
        //     ? r.misc_expenses.map((m) => ({
        //         description: m.description ?? "—",
        //         notes: m.notes ?? "",
        //         amount: n(m.amount),
        //         date: m.date ?? "",
        //       }))
        //     : [],
        // });
        const r = res.data || {};
        setData({
          summary: {
            // 👇 We show Net Revenue in "Total Revenue" tile to reflect actual earned after discounts.
            // If you want Gross here instead, swap rev.net_revenue -> rev.gross_revenue.
            total_revenue: n(rev?.net_revenue ?? r?.summary?.total_revenue),
            net_profit: n(rev?.net_profit ?? r?.summary?.net_profit),
            discounts: n(rev?.discounts ?? r?.summary?.discounts),
            return_rate:   n(rev?.return_rate ?? r?.summary?.return_rate),
          },
          product_breakdown: Array.isArray(r?.products)
            ? r.products.map((p) => ({
                product: p.product_name ?? p.product ?? "—",
                qty: n(p.qty_sold),
                revenue: n(p.revenue),
                profit: n(p.profit),
                discount_rate: n(p.discount_rate),
                return_rate: n(p.return_rate),
              }))
            : [],
          sales_by_route: Array.isArray(r?.by_route)
            ? r.by_route.map((x) => ({ name: x.route ?? x.name, revenue: n(x.revenue) }))
            : [],
          sales_by_warehouse: Array.isArray(r?.by_warehouse)
            ? r.by_warehouse.map((x) => ({ name: x.warehouse ?? x.name, revenue: n(x.revenue) }))
            : [],
          returns_block: {
            expected_sale: n(retanddisc?.expected_sale),
            actual_sale: n(retanddisc?.actual_sale),
            difference: n(retanddisc?.difference),
            supplier_returnables_bottle: n(retanddisc?.supplier_returnables_bottle),
            supplier_returnables_shell: n(retanddisc?.supplier_returnables_shell),
          },
          misc_expenses: Array.isArray(r?.misc_expenses)
            ? r.misc_expenses.map((m) => ({
                description: m.description ?? "—",
                notes: m.notes ?? "",
                amount: n(m.amount),
                date: m.date ?? "",
              }))
            : [],
        }); //kath
      } catch (e) {
        setErr(`Request failed: ${e.message}`);
        setData((d) => ({
          ...d,
          product_breakdown: [],
          sales_by_route: [],
          sales_by_warehouse: [],
          misc_expenses: [],
        }));
      } finally {
        ok && setLoading(false);
      }
    })();
    return () => (ok = false);
  }, [filters]);

  /* Derived rows */
  const filteredRows = useMemo(() => {
    const s = (q || "").toLowerCase().trim();
    const rows = data.product_breakdown.filter((r) =>
      s ? (r.product || "").toLowerCase().includes(s) : true
    );
    return [...rows].sort((a, b) => n(b[sortKey]) - n(a[sortKey]));
  }, [q, data.product_breakdown, sortKey]);

  const productHeaders = [
    { key: "product", label: "Product" },
    { key: "qty", label: "Qty Sold" },
    { key: "revenue", label: "Revenue" },
    { key: "profit", label: "Profit" },
    { key: "discount_rate", label: "Discount %" },
    { key: "return_rate", label: "Return Rate" },
  ];

  const exportCSV = () => {
    const csv = toCSV(filteredRows, productHeaders);
    saveFile("sales_report_products.csv", csv);
  };
  const exportExcel = () => {
    const csv = toCSV(filteredRows, productHeaders);
    saveFile("sales_report.xls", csv, "application/vnd.ms-excel");
  };
  const exportPDF = () => window.print();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6" ref={printRef}>
      {/* Header + filters */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Sales Report</h1>
          <p className="text-xs text-slate-500">Data-driven deep dive • avoids duplication with Dashboard</p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={filters.warehouse}
            onChange={(e) => setFilters((f) => ({ ...f, warehouse: e.target.value }))}
          >
            <option value="all">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name || w.warehouse_name || `#${w.id}`}
              </option>
            ))}
          </select>

          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={filters.route}
            onChange={(e) => setFilters((f) => ({ ...f, route: e.target.value }))}
          >
            <option value="all">All Routes</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name || r.route_name || `#${r.id}`}
              </option>
            ))}
          </select>

          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={filters.period}
            onChange={(e) => setFilters((f) => ({ ...f, period: e.target.value }))}
          >
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>

          {filters.period === "custom" && (
            <>
              <input
                type="date"
                className="border rounded-md px-3 py-2 text-sm"
                value={filters.start || ""}
                onChange={(e) => setFilters((f) => ({ ...f, start: e.target.value }))}
              />
              <input
                type="date"
                className="border rounded-md px-3 py-2 text-sm"
                value={filters.end || ""}
                onChange={(e) => setFilters((f) => ({ ...f, end: e.target.value }))}
              />
            </>
          )}

          <button onClick={exportPDF} className="btn btn-primary text-sm px-3 py-2">
            Export PDF
          </button>
          <button onClick={exportExcel} className="btn btn-back text-sm px-3 py-2">
            Export Excel
          </button>
        </div>
      </div>

      {err && (
        <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-md px-4 py-2 mb-4">
          {err}
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Metric label="Total Revenue" value={peso(data.summary.total_revenue)} />
        <Metric label="Net Profit" value={peso(data.summary.net_profit)} />
        <Metric label="Discounts" value={peso(data.summary.discounts)} />
        <Metric label="Return Rate" value={pct(data.summary.return_rate)} />
      </div>

      {/* Product + charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card title="Product Breakdown" className="lg:col-span-1">
          <ProductBreakdownTable
            loading={loading}
            rows={filteredRows}
            query={q}
            sortKey={sortKey}
            onQuery={setQ}
            onSort={setSortKey}
            onExportCSV={exportCSV}
          />
        </Card>

        <div className="grid grid-rows-2 gap-4">
          <Card title="Sales by Route">
            <SalesByRoutePie data={data.sales_by_route} />
          </Card>
          <Card title="Sales by Warehouse">
            <SalesByWarehouseBar data={data.sales_by_warehouse} />
          </Card>
        </div>
      </div>

      {/* Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Returns & Discrepancies">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric label="Expected Sales" value={peso(data.returns_block.expected_sale)} />
            <Metric label="Actual Sales" value={peso(data.returns_block.actual_sale)} />
            <Metric
                label="Difference"
                value={peso(data.returns_block.difference)}
              />
            <Metric label="Supplier Returnables (Bottle)" value={peso(data.returns_block.supplier_returnables_bottle)} />
            <Metric label="Supplier Returnables (Shell)" value={(data.returns_block.supplier_returnables_shell)} />
          </div>
          <div className="mt-3">
            <button className="btn btn-back text-xs px-3 py-2">View items</button>
          </div>
        </Card>

        <Card title="Miscellaneous & Expenses">
          <div className="overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left font-semibold px-3 py-2 border-b">Description</th>
                  <th className="text-left font-semibold px-3 py-2 border-b">Notes</th>
                  <th className="text-left font-semibold px-3 py-2 border-b">Amount</th>
                  <th className="text-left font-semibold px-3 py-2 border-b">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8">
                      <Empty text="Loading…" />
                    </td>
                  </tr>
                ) : data.misc_expenses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8">
                      <Empty text="No expenses for the selected filters." />
                    </td>
                  </tr>
                ) : (
                  data.misc_expenses.map((m, i) => (
                    <tr key={i} className="odd:bg-white even:bg-slate-50/50">
                      <td className="px-3 py-2 border-b">{m.description}</td>
                      <td className="px-3 py-2 border-b">{m.notes}</td>
                      <td className="px-3 py-2 border-b">{peso(m.amount)}</td>
                      <td className="px-3 py-2 border-b">{m.date}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
