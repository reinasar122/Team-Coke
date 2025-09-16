import React, { useEffect, useRef, useState } from "react";
import axios from "axios";

import Card from "../../components/common/Card";
import Metric from "../../components/common/Metric";
import SalesByRoutePie from "../../components/charts/SalesByRoutePie";
import SalesByWarehouseBar from "../../components/charts/SalesByWarehouseBar";
import Empty from "../../components/common/Empty";
import { n, peso, pct } from "../../utils/formatters";

import ProductBreakdownContainer from "../../containers/ProductBreakdownContainer";

import { FaChartBar } from "react-icons/fa";

const API = process.env.REACT_APP_API_URL || "http://localhost:8080/api";

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
    summary: { gross_revenue: 0, net_profit: 0, discounts: 0, return_rate: 0 },
    sales_by_route: [],
    sales_by_warehouse: [],
    returns_block: { expected_sale: 0, actual_sale: 0, difference: 0, supplier_returnables: 0 },
    misc_expenses: [],
  });

  const printRef = useRef(null);
  const [unitsSold, setUnitsSold] = useState(0);

  // Load select options
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
      } catch {
        /* ignore */
      }
    })();
    return () => (ok = false);
  }, []);

  // Fetch main sales report (ProductBreakdown is fetched inside its container)
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr("");

      try {
        // Build querystring once from filters
        const params = new URLSearchParams();
        params.set("warehouse_id", String(filters.warehouse ?? "all"));
        params.set("route_id", String(filters.route ?? "all"));
        params.set("period", filters.period);
        if (filters.period === "custom") {
          if (filters.start) params.set("start", filters.start);
          if (filters.end) params.set("end", filters.end);
        }
        const qs = params.toString();

        // Auth headers once
        const token = localStorage.getItem("token");
        const headers = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        // Try new endpoint, then fallback
        const [rpt1, rpt2] = await Promise.allSettled([
          axios.get(`${API}/sales_report/?${qs}`, { headers, timeout: 15000 }),
          axios.get(`${API}/reports/sales/?${qs}`, { headers, timeout: 15000 }),
        ]);
        if (!alive) return;

        let reportRes = null;
        if (rpt1.status === "fulfilled") reportRes = rpt1.value;
        else if (rpt2.status === "fulfilled") reportRes = rpt2.value;

        if (!reportRes) {
          const e1 = rpt1.status === "rejected" ? rpt1.reason?.message : "";
          const e2 = rpt2.status === "rejected" ? rpt2.reason?.message : "";
          throw new Error(`All report endpoints failed. ${e1 || ""} ${e2 || ""}`.trim());
        }

        const r = reportRes.data || {};
        setData({
          summary: {
              gross_revenue: n(r?.summary?.revenue?.gross_revenue),
              net_revenue: n(r?.summary?.revenue?.net_revenue),
              net_profit: n(r?.summary?.revenue?.net_profit),
              discounts: n(r?.summary?.discount?.total), // pick total discount
              return_rate: n(r?.summary?.return_rate),
            },
          sales_by_route: Array.isArray(r?.by_route)
            ? r.by_route.map((x) => ({ name: x.route ?? x.name, revenue: n(x.revenue) }))
            : [],
          sales_by_warehouse: Array.isArray(r?.by_warehouse)
            ? r.by_warehouse.map((x) => ({ name: x.warehouse ?? x.name, revenue: n(x.revenue) }))
            : [],
          returns_block: {
            expected_sale: n(r?.returns?.expected_sale),
            actual_sale: n(r?.returns?.actual_sale),
            difference: n(r?.returns?.difference),
            supplier_returnables: n(r?.returns?.supplier_returnables),
          },
          misc_expenses: Array.isArray(r?.misc_expenses)
            ? r.misc_expenses.map((m) => ({
                description: m.description ?? "—",
                notes: m.notes ?? "",
                amount: n(m.amount),
                date: m.date ?? "",
                receipt_url: m.receipt_url ?? null,
              }))
            : [],
        });
      } catch (e) {
        setErr(`Request failed: ${e?.message || e}`);
        // keep summary but clear lists to avoid stale visuals
        setData((d) => ({
          ...d,
          sales_by_route: [],
          sales_by_warehouse: [],
          misc_expenses: [],
        }));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [filters]);

  const exportPDF = () => window.print();

  const allWarehouseNames = warehouses.map((w) => w?.name || w?.warehouse_name).filter(Boolean);
  const chartWarehouses = filters.warehouse === "all" ? allWarehouseNames : [];

  const selectedWarehouseName =
    filters.warehouse === "all"
      ? null
      : warehouses.find((w) => String(w.id) === String(filters.warehouse))?.name ||
        warehouses.find((w) => String(w.id) === String(filters.warehouse))?.warehouse_name ||
        null;

  // Single-line, plain-text renderer for Transaction Info (used in misc table)
  /* function TxnInfo({ notes }) {
    const raw = String(notes || "")
      .split("•")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => s.toLowerCase() !== "receipt attached");

    const seen = new Set();
    const uniq = [];
    for (const p of raw) {
      const k = p.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        uniq.push(p);
      }
    }

    uniq.sort((a, b) => {
      const aMSP = /^msp\s/i.test(a) ? 0 : 1;
      const bMSP = /^msp\s/i.test(b) ? 0 : 1;
      return aMSP - bMSP || a.localeCompare(b);
    });

    const text = (uniq.join(", ") || "—").trim();
    return (
      <div
        className="w-full whitespace-nowrap overflow-hidden text-ellipsis text-left"
        title={text}
      >
        {text}
      </div>
    );
  } */

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6" ref={printRef}>
      {/* Header + filters */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-2xl flex items-center gap-2 font-bold">
            <FaChartBar /> Sales Report
          </h1>
          <p className="text-xs text-slate-500">
            Data-driven deep dive • avoids duplication with Dashboard
          </p>
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
        </div>
      </div>

      {err && (
        <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-md px-4 py-2 mb-4">
          {err}
        </div>
      )}

      {/* Top metrics */}
      <div className="grid gap-4 mb-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <div className="p-4 border rounded bg-white">
          <p className="text-sm text-gray-500">Gross Revenue</p>
          <h3 className="text-xl font-bold">
            {peso((data.summary.gross_revenue ?? 0) + (data.summary.discounts ?? 0))}
          </h3>
        </div>
        <div className="p-4 border rounded bg-white">
          <p className="text-sm text-gray-500">Net Revenue</p>
          <h3 className="text-xl font-bold">{peso(data.summary.net_revenue ?? 0)}</h3>
        </div>
        <div className="p-4 border rounded bg-white">
          <p className="text-sm text-gray-500">Net Profit</p>
          <h3 className="text-xl font-bold">{peso(data.summary.net_profit ?? 0)}</h3>
        </div>
        <div className="p-4 border rounded bg-white">
          <p className="text-sm text-gray-500">Discounts</p>
          <h3 className="text-xl font-bold">
            {((data.summary.discounts ?? 0) * 100).toFixed(2)}%
          </h3>
        </div>
        <div className="p-4 border rounded bg-white">
          <p className="text-sm text-gray-500">Return Rate</p>
          <h3 className="text-xl font-bold">{pct(data.summary.return_rate ?? 0)}</h3>
        </div>
      </div>

      {/* Product + charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card title="Product Breakdown" className="lg:col-span-1">
          {/* show units sold (from ProductBreakdownContainer callback) */}
          <div className="text-sm text-slate-500 mb-2">Units sold: <strong>{n(unitsSold)}</strong></div>

          <ProductBreakdownContainer
            key={`${filters.warehouse}-${filters.route}-${filters.period}-${filters.start}-${filters.end}`}
            apiBase={API.replace("/api", "")}
            warehouseId={filters.warehouse ?? "all"}
            routeId={filters.route ?? "all"}
            period={filters.period}
            start={filters.start}
            end={filters.end}
            onTotalsChange={(t) => setUnitsSold(t.units)}
          />
        </Card>

        <div className="grid grid-rows-2 gap-4">
          <Card title="Sales by Route">
            {loading ? <Empty text="Loading…" /> : <SalesByRoutePie data={data.sales_by_route} />}
          </Card>
          <Card title="Sales by Warehouse">
            {loading ? (
              <Empty text="Loading…" />
            ) : (
              <SalesByWarehouseBar
                data={data.sales_by_warehouse}
                warehouses={chartWarehouses}
                focus={selectedWarehouseName}
              />
            )}
          </Card>
        </div>
      </div>

      {/* Bottom blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Returns & Discrepancies">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric label="Expected Sales" value={peso(data.returns_block.expected_sale)} />
            <Metric label="Actual Sales" value={peso(data.returns_block.actual_sale)} />
            <Metric label="Difference" value={peso(data.returns_block.difference)} />
            <Metric label="Supplier Returnables" value={peso(data.returns_block.supplier_returnables)} />
          </div>
          <div className="mt-3">
            <button className="btn btn-back text-xs px-3 py-2">View items</button>
          </div>
        </Card>

        <Card title="Miscellaneous & Expenses">
          <div className="overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[25%]" />
                <col className="w-[30%]" />
                <col className="w-[20%]" />
                <col className="w-[25%]" />
              </colgroup>
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-center font-semibold px-3 py-2 border-b">Description</th>
                  <th className="text-center font-semibold px-3 py-2 border-b">Transaction Info</th>
                  <th className="text-center font-semibold px-3 py-2 border-b">Amount</th>
                  <th className="text-center font-semibold px-3 py-2 border-b">Date</th>
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
                      <td className="text-center px-3 py-2 border-b">{m.description}</td>
                      <td className="text-center px-3 py-2 border-b">{m.notes}</td>
                      <td className="text-center px-3 py-2 border-b whitespace-nowrap">{peso(m.amount)}</td>
                      <td className="text-center px-3 py-2 border-b whitespace-nowrap">{m.date}</td>
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