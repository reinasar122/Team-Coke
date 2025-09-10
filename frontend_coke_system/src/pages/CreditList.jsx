// src/pages/CreditList.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaEye } from "react-icons/fa"; // 👈 import icon
import "../styles/pages/credit.scss"; // custom styles

export default function CreditList() {
  const [rows, setRows] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data } = await axios.get("http://127.0.0.1:8080/api/credits/");
      setRows(Array.isArray(data) ? data : []);
    })();
  }, []);

  const fmt = (v) => Number(v || 0).toFixed(2);
  const dt = (v) => (v ? new Date(v).toLocaleString() : "—");

  // --- helpers for status normalization ---
  const norm = (s) => String(s || "").trim().toUpperCase();
  const isPaid = (s) => {
    const x = norm(s);
    // Treat these as PAID; adjust to match your backend statuses if needed
    return x === "PAID" || x === "FULLY PAID" || x === "SETTLED";
  };
  const isPending = (s) => norm(s) === "PENDING";
  const isPartial = (s) => ["PARTIAL", "PARTIALLY PAID"].includes(norm(s));

  const statusLabel = (s) => {
    if (isPending(s)) return "Pending";
    if (isPartial(s)) return "Partially Paid";
    if (isPaid(s)) return "Fully Paid";
    // Fallback: show raw
    return String(s || "").toString();
  };

  const statusClass = (s) => {
    if (isPending(s)) return "status-pending";
    if (isPartial(s)) return "status-partial";
    if (isPaid(s)) return "status-paid";
    return "status-pending";
  };

  // --- sort: unpaid first (Pending/Partial), paid at bottom; each group by Date desc ---
  const sortedRows = [...rows].sort((a, b) => {
    const aPaid = isPaid(a.status) ? 1 : 0;
    const bPaid = isPaid(b.status) ? 1 : 0;
    if (aPaid !== bPaid) return aPaid - bPaid; // unpaid(0) first, paid(1) last

    // within same group, sort by created_at (newest first)
    const at = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bt - at;
  });

  return (
    <div className="creditlist-container">
      <h1 className="text-xl font-bold mb-4">Credit List</h1>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th className="text-center">MSP No.</th>
              <th className="text-center">Date &amp; Time</th>
              <th className="text-center">Handled By</th>
              <th className="text-center">Customer</th>
              <th className="text-center">Total</th>
              <th className="text-center">Paid</th>
              <th className="text-center">Balance</th>
              <th className="text-center">Status</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>

          <tbody>
            {sortedRows.map((r) => (
              <tr key={r.id}>
                <td>{r.msp_no}</td>
                <td>{dt(r.created_at)}</td>
                <td>{r.handled_by || "—"}</td>
                <td>{r.customer_name || "—"}</td>
                <td>₱{fmt(r.total_amount)}</td>
                <td>₱{fmt(r.amount_paid)}</td>
                <td>₱{fmt(r.balance)}</td>
                <td>
                  <span className={statusClass(r.status)}>{statusLabel(r.status)}</span>
                </td>
                <td className="w-128 text-center">
                  <button
                    className="icon-btn icon-btn-view"
                    onClick={() => navigate(`/credits/${r.id}`)}
                    title="View details"
                  >
                    <FaEye />
                  </button>
                </td>
              </tr>
            ))}

            {!sortedRows.length && (
              <tr>
                <td colSpan={9} className="text-muted" style={{ textAlign: "center", padding: 16 }}>
                  No credit records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
