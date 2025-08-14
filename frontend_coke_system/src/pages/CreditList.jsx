import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function CreditList() {
  const [rows, setRows] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data } = await axios.get("http://127.0.0.1:8080/api/credits/");
      setRows(data);
    })();
  }, []);

  const fmt = (v) => Number(v || 0).toFixed(2);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Credit List</h1>
      <table className="w-full border">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">MSP No.</th>
            <th className="p-2 text-left">Date & Time</th>
            <th className="p-2 text-left">Handled By</th>
            <th className="p-2 text-left">Customer</th>
            <th className="p-2 text-left">Total</th>
            <th className="p-2 text-left">Paid</th>
            <th className="p-2 text-left">Balance</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.msp_no}</td>
              <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
              <td className="p-2">{r.handled_by || "—"}</td>
              <td className="p-2">{r.customer_name}</td>
              <td className="p-2">₱{fmt(r.total_amount)}</td>
              <td className="p-2">₱{fmt(r.amount_paid)}</td>
              <td className="p-2">₱{fmt(r.balance)}</td>
              <td className="p-2">
                {r.status === "PENDING"
                  ? "Pending"
                  : r.status === "PARTIAL"
                  ? "Partially Paid"
                  : "Fully Paid"}
              </td>
              <td className="p-2">
                <button
                  className="px-3 py-1 rounded bg-blue-600 text-white"
                  onClick={() => navigate(`/credits/${r.id}`)}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={9} className="p-4 text-center text-gray-500">
                No credit records.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
