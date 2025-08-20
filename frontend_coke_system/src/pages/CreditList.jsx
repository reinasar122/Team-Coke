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

  const statusLabel = (s) => {
    if (s === "PENDING") return "Pending";
    if (s === "PARTIAL") return "Partially Paid";
    return "Fully Paid";
  };

  const statusClass = (s) => (s === "PENDING" ? "status-pending" : "status-paid");

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Credit List</h1>

      <table className="table credit-list-table">
        <thead>
          <tr>
            <th className="text-left">MSP No.</th>
            <th className="text-left">Date &amp; Time</th>
            <th className="text-left">Handled By</th>
            <th className="text-left">Customer</th>
            <th className="text-left">Total</th>
            <th className="text-left">Paid</th>
            <th className="text-left">Balance</th>
            <th className="text-left">Status</th>
            <th className="text-left">Action</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
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

          {!rows.length && (
            <tr>
              <td colSpan={9} className="text-muted" style={{ textAlign: "center", padding: 16 }}>
                No credit records.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
