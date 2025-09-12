import React, { useEffect, useState } from "react";
import axios from "axios";
import dayjs from "dayjs";

/* ------------------ helpers ------------------ */
const peso = (n) =>
  `₱${(parseFloat(n) || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const API = "http://localhost:8080/api";
const authHeaders = () => ({
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});

export default function Expenses() {
  const [items, setItems] = useState([]); // miscellaneous items
  const [merch, setMerch] = useState([]); // merchandisings
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setErr("");

        const [miscRes, merchRes] = await Promise.all([
          axios.get(`${API}/miscellaneous-items/`, authHeaders()),
          axios.get(`${API}/merchandisings/`, authHeaders()),
        ]);

        // sort by created_at DESC (latest first)
        // sort by created_at DESC, then id DESC (for stable "latest on top")
            const sortedItems = [...(miscRes.data || [])].sort((a, b) => {
            const ta = new Date(a.created_at || a.updated_at || a.date || 0).getTime();
            const tb = new Date(b.created_at || b.updated_at || b.date || 0).getTime();
            if (tb !== ta) return tb - ta;          // newer timestamp first
            return (b.id ?? 0) - (a.id ?? 0);       // if same time, higher id first
            });

            setItems(sortedItems);


        setItems(sortedItems);
        setMerch(merchRes.data || []);
      } catch (e) {
        console.error(e);
        setErr("Failed to load expenses data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // map merch id → msp_no for quick lookup
  const merchMap = {};
  merch.forEach((m) => {
    merchMap[m.id] = m.msp_no;
  });

  const total = items.reduce((sum, x) => sum + (parseFloat(x.amount) || 0), 0);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">All Expenses</h1>

      {loading && <div>Loading…</div>}
      {err && <div className="text-red-500">{err}</div>}

      {!loading && !err && (
        <table className="w-full border border-gray-300 rounded-md overflow-hidden">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-2 border-b">Date & Time</th>
              <th className="p-2 border-b">MSP No</th>
              <th className="p-2 border-b">Description</th>
              <th className="p-2 border-b text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan="4" className="p-4 text-center text-gray-500">
                  No expenses found
                </td>
              </tr>
            )}
            {items.map((exp) => (
              <tr key={exp.id}>
                <td className="p-2 border-b">
                  {dayjs(exp.created_at).format("MMM DD, YYYY hh:mm A")}
                </td>
                <td className="p-2 border-b">
                  {merchMap[exp.merchandising] || "—"}
                </td>
                <td className="p-2 border-b">{exp.description || "—"}</td>
                <td className="p-2 border-b text-right">{peso(exp.amount)}</td>
              </tr>
            ))}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td colSpan="3" className="p-2 border-t text-right">
                  Total
                </td>
                <td className="p-2 border-t text-right">{peso(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </div>
  );
}
