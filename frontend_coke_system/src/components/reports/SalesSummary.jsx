import React, { useMemo } from "react";
import "../../styles/salesreport.scss";

const fmtMoney = (n = 0) =>
  `₱${Number(n).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const PriorityBadge = ({ level = "low" }) => {
  const lv = String(level).toLowerCase();
  return <span className={`badge badge-${lv}`}>{`${lv[0].toUpperCase()}${lv.slice(1)} Priority`}</span>;
};

// helper to read either camelCase or snake_case
const getNum = (o, camelKey, snakeKey) =>
  Number(o?.[camelKey] ?? o?.[snakeKey] ?? 0);

export default function SalesSummary({ loading, metrics, recommendations, rows = [] }) {
  const hasData = rows.length > 0;

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.revenue      += getNum(r, "revenue", "revenue");
        acc.productsSold += getNum(r, "productsSold", "products_sold") || getNum(r, "products", "products");
        acc.returns      += getNum(r, "returns", "returns");
        acc.miscCharges  += getNum(r, "miscCharges", "misc_charges") || getNum(r, "misc", "misc");
        acc.netProfit    += getNum(r, "netProfit", "net_profit") || getNum(r, "profit", "profit");
        return acc;
      },
      { revenue: 0, productsSold: 0, returns: 0, miscCharges: 0, netProfit: 0 }
    );
  }, [rows]);

  return (
    <>
      {/* === Row 1: KPIs (left) + Product Recommendations (right) === */}
      <section className="top-grid">
        <div className="card kpi-card">
          <div className="kpi-grid">
            <div className="kpi kpi-green">
              <div className="kpi-value">{fmtMoney(metrics?.totalRevenue || 0)}</div>
              <div className="kpi-label">Total Revenue</div>
            </div>
            <div className="kpi kpi-blue">
              <div className="kpi-value">{Number(metrics?.productsSold || 0).toLocaleString("en-PH")}</div>
              <div className="kpi-label">Products Sold</div>
            </div>
            <div className="kpi kpi-amber">
              <div className="kpi-value">{Number(metrics?.supplierReturns || 0).toLocaleString("en-PH")}</div>
              <div className="kpi-label">Supplier Returns</div>
            </div>
            <div className="kpi kpi-purple">
              <div className="kpi-value">{fmtMoney(metrics?.netProfit || 0)}</div>
              <div className="kpi-label">Net Profit</div>
            </div>
          </div>
        </div>

        <div className="card recs-card">
          <div className="section-title">📈 Product Recommendations</div>
          <div className="recs-grid">
            {(recommendations || []).map((rec, i) => (
              <div className="rec" key={i}>
                <div className="rec-header">
                  <h4>{rec.name}</h4>
                  <PriorityBadge level={rec.priority} />
                </div>
                <div className="rec-notes">
                  <span className="muted">{rec.note}</span>
                  <span className="muted action">{rec.action}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === Row 2: Full‑width Sales Summary === */}
      <section className="summary-full">
        <div className="card">
          <div className="section-title">Sales Summary</div>

          {loading ? (
            <div className="empty-state"><div className="spinner" /> Loading…</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Revenue</th>
                    <th>Products Sold</th>
                    <th>Returns</th>
                    <th>Misc Charges</th>
                    <th>Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {hasData ? (
                    rows.map((r, idx) => {
                      const revenue      = getNum(r, "revenue", "revenue");
                      const productsSold = getNum(r, "productsSold", "products_sold") || getNum(r, "products", "products");
                      const returns      = getNum(r, "returns", "returns");
                      const miscCharges  = getNum(r, "miscCharges", "misc_charges") || getNum(r, "misc", "misc");
                      const netProfit    = getNum(r, "netProfit", "net_profit") || getNum(r, "profit", "profit");
                      return (
                        <tr key={idx}>
                          <td>{r.date}</td>
                          <td>{fmtMoney(revenue)}</td>
                          <td>{productsSold.toLocaleString("en-PH")}</td>
                          <td>{returns.toLocaleString("en-PH")}</td>
                          <td>{fmtMoney(miscCharges)}</td>
                          <td className={netProfit < 0 ? "neg" : ""}>{fmtMoney(netProfit)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center text-gray-500 py-6">
                        No sales recorded for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total</th>
                    <th>{fmtMoney(totals.revenue)}</th>
                    <th>{totals.productsSold.toLocaleString("en-PH")}</th>
                    <th>{totals.returns.toLocaleString("en-PH")}</th>
                    <th>{fmtMoney(totals.miscCharges)}</th>
                    <th className={totals.netProfit < 0 ? "neg" : ""}>{fmtMoney(totals.netProfit)}</th>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}