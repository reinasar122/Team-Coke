// src/pages/SalesReport.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import ReportFilters from "../../components/reports/ReportFilters";
import SalesSummary from "../../components/reports/SalesSummary";

const API_BASE = "http://127.0.0.1:8080"; // backend base

/* ---------------- helpers ---------------- */
const startOfDayISO = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
};
const endOfNowISO = () => new Date().toISOString();

const rangeFromLabel = (label) => {
  const now = new Date();
  const end = endOfNowISO();

  switch ((label || "").toLowerCase()) {
    case "today": {
      return { from: startOfDayISO(now), to: end };
    }
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const to = new Date(y);
      to.setHours(23, 59, 59, 999);
      return { from: startOfDayISO(y), to: to.toISOString() };
    }
    case "this week": {
      const w = new Date(now);
      const day = w.getDay();
      const diffToMon = (day + 6) % 7;
      w.setDate(w.getDate() - diffToMon);
      return { from: startOfDayISO(w), to: end };
    }
    case "this month": {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDayISO(m), to: end };
    }
    default:
      return { from: startOfDayISO(now), to: end };
  }
};
/* ----------------------------------------- */

const POLL_MS = 8000; // refresh every 8s

const SalesReport = () => {
  // ---- Filters ----
  const [dateRange, setDateRange] = useState("Today");
  const [warehouse, setWarehouse] = useState("Both Warehouses");
  const [reportType, setReportType] = useState("Sales Summary");

  // ---- Data ----
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    productsSold: 0,
    supplierReturns: 0,
    netProfit: 0,
  });
  const [recommendations, setRecommendations] = useState([]);
  const [rows, setRows] = useState([]);
  const [topSelling, setTopSelling] = useState([]); // ⬅️ NEW

  // Detect print layout from route or query (?print=1)
  const { pathname, search } = useLocation();
  const isPrintLayout =
    pathname.includes("/print") || new URLSearchParams(search).get("print") === "1";

  useEffect(() => {
    document.body.classList.add("sales-report-print");
    return () => document.body.classList.remove("sales-report-print");
  }, []);

  // compute ISO range whenever label changes
  const { from, to } = useMemo(() => rangeFromLabel(dateRange), [dateRange]);

  // polling machinery
  const timerRef = useRef(null);

  const fetchData = async () => {
    if (document.hidden) return;
    setLoading(true);

    try {
      // ---- Metrics Summary ----
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if ((warehouse || "").toLowerCase() !== "both warehouses") {
        params.set("warehouse", warehouse);
      }
      params.set("type", reportType);

      const resp = await fetch(`${API_BASE}/api/sales-report/?${params}`);
      const data = await resp.json();

      const m = data?.metrics ?? {};
      setMetrics({
        totalRevenue: m.total_revenue ?? 0,
        productsSold: m.products_sold ?? 0,
        supplierReturns: m.supplier_returns_units ?? 0,
        netProfit: m.net_profit ?? 0,
      });
      setRecommendations(Array.isArray(data?.recommendations) ? data.recommendations : []);
      setRows(Array.isArray(data?.rows) ? data.rows : []);

      // ---- Top Products ----
      const tpParams = new URLSearchParams(params); // reuse same filters
      tpParams.set("limit", "8");
      const resTop = await fetch(`${API_BASE}/api/top-products/?${tpParams}`);
      const dataTop = await resTop.json();
      setTopSelling(Array.isArray(dataTop?.items) ? dataTop.items : []);
    } catch (err) {
      console.error("sales-report fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // initial fetch + polling loop; restart whenever filters change
  useEffect(() => {
    fetchData();
    timerRef.current = setInterval(fetchData, POLL_MS);

    const onVis = () => {
      if (!document.hidden) fetchData();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [from, to, warehouse, reportType]);

  const filters = useMemo(
    () => ({ dateRange, warehouse, reportType, fromISO: from, toISO: to }),
    [dateRange, warehouse, reportType, from, to]
  );

  return (
    <div className="sales-report-page compact">
      {/* Header */}
      <div className="page-header mb-3 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2 mb-1">
            <span role="img" aria-label="chart">📊</span> Sales Report
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Detailed sales analysis and reporting.</p>
        </div>

        {/* ACTIONS (hidden on print layout) */}
        {!isPrintLayout && (
          <div className="sr-actions flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
            >
              🖨️ <span>Print</span>
            </button>
            <button
              onClick={() => alert("Exporting…")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-white bg-gray-900 hover:bg-gray-800 shadow-sm"
            >
              ⬇️ <span>Export</span>
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <ReportFilters
        dateRange={dateRange} setDateRange={setDateRange}
        warehouse={warehouse} setWarehouse={setWarehouse}
        reportType={reportType} setReportType={setReportType}
      />

      {/* Summary */}
      <SalesSummary
        loading={loading}
        metrics={metrics}
        recommendations={recommendations}
        rows={rows}
        filters={filters}
      />

      
    </div>
  );
};

export default SalesReport;