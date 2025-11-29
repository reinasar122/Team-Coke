import React, { useEffect, useState, useRef } from "react";
import api from "../api";  // Import the custom API instance
import Card from "../../components/common/Card";
import Metric from "../../components/common/Metric";
import SalesByWarehouseBar from "../../components/charts/SalesByWarehouseBar";
import SalesByRouteBar from "../../components/charts/SalesByRoutePie";
import Empty from "../../components/common/Empty";
import { n, peso, pct } from "../../utils/formatters";
import ProductBreakdownContainer from "../../containers/ProductBreakdownContainer";
import { FaChartBar } from "react-icons/fa";

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
    summary: { gross_revenue: 0, net_profit: 0, discounts: 0, returned_rate: 0 },
    sales_by_warehouse: [],
    sales_by_route: [],
    returns_block: { expected_sale: 0, actual_sale: 0, difference: 0, supplier_returnables: 0 },
    misc_expenses: [],
  });

  const printRef = useRef(null);
  const [unitsSold, setUnitsSold] = useState(0);
  const [showAllExpenses, setShowAllExpenses] = useState(false);

  // Load dropdown options for warehouses and routes
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const [wh, rt] = await Promise.allSettled([
          api.get(`/warehouses/`),  // Use api.js for warehouse data
          api.get(`/routes/`),       // Use api.js for route data
        ]);

        if (!cancelled) {
          setWarehouses(wh.status === "fulfilled" ? wh.value.data : []);
          setRoutes(rt.status === "fulfilled" ? rt.value.data : []);
        }
      } catch (error) {
        console.error("Error loading warehouses and routes:", error);
      }
    };
    fetchData();

    return () => (cancelled = true);
  }, []);

  // Fetch sales report data
  useEffect(() => {
    let alive = true;
    const fetchSalesReport = async () => {
      setLoading(true);
      setErr("");

      try {
        const params = new URLSearchParams();
        params.set("warehouse_id", String(filters.warehouse ?? "all"));
        params.set("route_id", String(filters.route ?? "all"));
        params.set("period", filters.period);
        if (filters.period === "custom") {
          if (filters.start) params.set("start", filters.start);
          if (filters.end) params.set("end", filters.end);
        }

        const response = await api.get(`/sales_report/?${params.toString()}`);
        const r = response.data || {};

        setData({
          summary: {
            gross_revenue: n(r?.summary?.revenue?.gross_revenue),
            net_revenue: n(r?.summary?.revenue?.net_revenue),
            net_profit: n(r?.summary?.revenue?.net_profit),
            discounts: n(r?.summary?.discount?.total_amount),
            returned_rate: n(r?.summary?.returned_rate ?? r?.summary?.return_rate),
          },
          sales_by_warehouse: Array.isArray(r?.by_warehouse)
            ? r.by_warehouse.map((x) => ({
                name: x.warehouse ?? x.name,
                revenue: n(x.revenue),
              }))
            : [],
          sales_by_route: Array.isArray(r?.by_route)
            ? r.by_route.map((x) => ({
                name: x.route ?? x.name,
                revenue: n(x.revenue),
              }))
            : [],
          returns_block: {
            expected_sale: n(r?.returns?.expected_sale),
            actual_sale: n(r?.returns?.actual_sale),
            difference: n(r?.returns?.difference),
            supplier_returnables: {
              bottle: n(r?.returns?.supplier_returnables?.bottle),
              shell: n(r?.returns?.supplier_returnables?.shell),
            },
          },
          misc_expenses: Array.isArray(r?.misc_expenses)
            ? r.misc_expenses.map((m) => ({
                description: m.description ?? "—",
                notes: m.notes ?? "",
                amount: n(m.amount),
                date: m.date ?? "",
              }))
            : [],
        });

        // Additional debug logs
        console.groupCollapsed("🧾 Sales Report Totals Check");
        console.log("Gross Revenue:", n(r?.summary?.revenue?.gross_revenue));
        console.log("Net Profit:", n(r?.summary?.revenue?.net_profit));
        console.log("Discounts:", n(r?.summary?.discount?.total_amount));
        console.log("Returned Rate:", n(r?.summary?.returned_rate ?? r?.summary?.return_rate));
        console.groupEnd();

      } catch (error) {
        if (alive) {
          setErr(`Request failed: ${error?.message || error}`);
          setData((prevData) => ({
            ...prevData,
            sales_by_warehouse: [],
            sales_by_route: [],
            misc_expenses: [],
          }));
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchSalesReport();
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

  const miscTotal = data.misc_expenses.reduce((sum, m) => sum + (m.amount || 0), 0);

  const previewLimit = 5;
  const expensesToShow = showAllExpenses
    ? data.misc_expenses
    : data.misc_expenses.slice(0, previewLimit);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6" ref={printRef}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-2xl flex items-center gap-2 font-bold">
            <FaChartBar /> Sales Report
          </h1>
          <p className="text-xs text-slate-500">Data-driven insights for performance tracking</p>
        </div>

        {/* Filters */}
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

      {/* KPI Metrics */}
      <div className="grid gap-4 mb-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Metric label="Gross Revenue" value={peso(data.summary.gross_revenue ?? 0)} />
        <Metric label="Net Revenue" value={peso(data.summary.net_revenue ?? 0)} />
        <Metric label="Net Income" value={peso(data.summary.net_profit ?? 0)} />
        <Metric label="Discounts" value={peso(data.summary.discounts ?? 0)} />
        <Metric label="Returned Rate" value={pct(data.summary.returned_rate ?? 0)} />
      </div>

      {/* Product Breakdown */}
      <div className="mb-6">
        <Card title="Product Breakdown">
          <div className="text-sm text-slate-500 mb-2">
            Units sold: <strong>{n(unitsSold)}</strong>
          </div>

          <ProductBreakdownContainer
            key={`${filters.warehouse}-${filters.route}-${filters.period}-${filters.start}-${filters.end}`}
            warehouseId={filters.warehouse ?? "all"}
            routeId={filters.route ?? "all"}
            period={filters.period}
            start={filters.start}
            end={filters.end}
            onTotalsChange={(t) => setUnitsSold(t.units)}
          />
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card title="Sales by Warehouse">
          {loading ? <Empty text="Loading…" /> : <SalesByWarehouseBar data={data.sales_by_warehouse} />}
        </Card>

        <Card title="Sales by Route">
          {loading ? <Empty text="Loading…" /> : <SalesByRouteBar data={data.sales_by_route} />}
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="space-y-4">
        <Card title="Returns & Discrepancies">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Metric label="Actual Sales" value={peso(data.returns_block.actual_sale)} />
            <Metric label="Supplier Returnables (Bottle)" value={n(data.returns_block.supplier_returnables.bottle)} />
            <Metric label="Supplier Returnables (Shell)" value={n(data.returns_block.supplier_returnables.shell)} />
          </div>
        </Card>

        <Card title="Miscellaneous Expenses">
          <div className="rounded-lg border border-slate-200 flex flex-col">
            {/* Scrollable table area */}
            <div className="max-h-72 overflow-y-auto">
              <table className="min-w-full text-sm table-fixed">
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
                    expensesToShow.map((m, i) => (
                      <tr key={i} className="odd:bg-white even:bg-slate-50/50">
                        <td className="text-center px-3 py-2 border-b">{m.description}</td>
                        <td className="text-center px-3 py-2 border-b">{m.notes}</td>
                        <td className="text-center px-3 py-2 border-b">{peso(m.amount)}</td>
                        <td className="text-center px-3 py-2 border-b">{m.date}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Info + toggle */}
            {data.misc_expenses.length > previewLimit && (
              <div className="px-3 py-2 border-t border-slate-200 text-xs flex items-center justify-between text-slate-500">
                <span>
                  Showing{" "}
                  <span className="font-semibold">
                    {showAllExpenses ? data.misc_expenses.length : previewLimit}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold">{data.misc_expenses.length}</span>{" "}
                  expenses
                </span>
                <button
                  type="button"
                  className="text-blue-600 font-semibold hover:underline"
                  onClick={() => setShowAllExpenses((v) => !v)}
                >
                  {showAllExpenses ? "Show less" : "View full expenses"}
                </button>
              </div>
            )}

            {/* Total footer */}
            <div className="px-3 py-2 border-t border-slate-200 text-xs text-right text-slate-500">
              Total Miscellaneous:{" "}
              <span className="font-semibold text-slate-700">{peso(miscTotal)}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
