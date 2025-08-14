// src/credits/CreditDetail.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

const API = "http://127.0.0.1:8080"; // backend base URL

export default function CreditDetail() {
  const { id } = useParams();
  const [ledger, setLedger] = useState(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setError("");
      const { data } = await axios.get(`${API}/api/credits/${id}/`);
      setLedger(data);
    } catch (e) {
      console.error(e);
      setError("Failed to load credit receipt.");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fmt = (v) => Number(v || 0).toFixed(2);

  const addPayment = async (value, method = "cash", note = "") => {
    try {
      await axios.post(`${API}/api/credits/${id}/payments/`, {
        amount: Number(value),
        method,
        note,
        recorded_by: ledger?.handled_by || ""
      });
      setAmount("");
      await load();
    } catch (e) {
      console.error(e);
      alert("Failed to add payment.");
    }
  };

  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!ledger) return <div className="p-4">Loading…</div>;

  const fullyPay = ledger.balance;

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold">Credit Receipt</h1>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><strong>MSP No:</strong> {ledger.msp_no}</div>
        <div><strong>Date:</strong> {new Date(ledger.created_at).toLocaleString()}</div>
        <div><strong>Customer:</strong> {ledger.customer_name}</div>
        <div><strong>Handled By:</strong> {ledger.handled_by || "—"}</div>
        <div><strong>Status:</strong> {ledger.status}</div>
        <div><strong>Due Date:</strong> {ledger.due_date ? new Date(ledger.due_date).toLocaleDateString() : "—"}</div>
      </div>

      <div className="border rounded">
        <div className="px-4 py-2 font-semibold bg-gray-100">Items</div>
        <div className="p-4">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="p-2">Product</th>
                <th className="p-2">Sold Shell</th>
                <th className="p-2">Sold PC</th>
                <th className="p-2">Unit Price</th>
                <th className="p-2">Discount %</th>
                <th className="p-2">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {(ledger.rows_json || []).map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{r.productName || r.product_name || "—"}</td>
                  <td className="p-2">{r.sold_shell ?? r.soldShell ?? 0}</td>
                  <td className="p-2">{r.sold_pcs ?? r.soldPcs ?? r.qty ?? r.quantity ?? 0}</td>
                  <td className="p-2">₱{fmt(r.unitPrice ?? r.selling_price ?? r.price ?? 0)}</td>
                  <td className="p-2">{fmt(r.discount_percent ?? r.discount ?? 0)}</td>
                  <td className="p-2">₱{fmt(r.actualSale ?? r.actual_sale ?? r.total ?? r.line_total ?? r.lineTotal ?? 0)}</td>
                </tr>
              ))}
              {!ledger.rows_json?.length && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500">
                    No items snapshot.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border rounded p-4 space-y-2 text-sm">
        <div><strong>Total:</strong> ₱{fmt(ledger.total_amount)}</div>
        <div><strong>Paid:</strong> ₱{fmt(ledger.amount_paid)}</div>
        <div><strong>Balance:</strong> ₱{fmt(ledger.balance)}</div>
      </div>

      <div className="border rounded p-4 space-y-3">
        <div className="font-semibold">Add Payment</div>
        <div className="flex gap-2">
          <input
            type="number"
            className="border rounded px-2 py-1"
            value={amount}
            placeholder="Amount"
            onChange={(e) => setAmount(e.target.value)}
          />
          <button
            className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-60"
            disabled={!Number(amount) || Number(amount) <= 0}
            onClick={() => addPayment(amount, "cash")}
          >
            Partial Pay
          </button>
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
            disabled={Number(fullyPay) <= 0}
            onClick={() => addPayment(fullyPay, "cash", "Full payment")}
          >
            Fully Pay
          </button>
        </div>
      </div>
    </div>
  );
}
