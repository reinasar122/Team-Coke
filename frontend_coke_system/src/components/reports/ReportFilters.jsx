import React from "react";
import "../../styles/salesreport.scss";

export default function ReportFilters({
  dateRange, setDateRange,
  warehouse, setWarehouse,
  reportType, setReportType
}) {
  return (
    <section className="card filters-card">
      <div className="filters-grid">
        <div className="form-group">
          <label>Date Range</label>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option>Today</option>
            <option>Yesterday</option>
            <option>This Week</option>
            <option>This Month</option>
            <option>Custom</option>
          </select>
        </div>

        <div className="form-group">
          <label>Warehouse</label>
          <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
            <option>Both Warehouses</option>
            <option>Warehouse A</option>
            <option>Warehouse B</option>
          </select>
        </div>

        <div className="form-group">
          <label>Report Type</label>
          <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
            <option>Sales Summary</option>
            <option>By Product</option>
            <option>By Route</option>
            <option>By Cashier</option>
          </select>
        </div>
      </div>
    </section>
  );
}