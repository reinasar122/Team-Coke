// src/pages/CreditDetail.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

const API = "http://localhost:8080"; // backend base URL

export default function CreditDetail() {
  const { id } = useParams();
  const [ledger, setLedger] = useState(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  // Persist info so it's visible even after full payment/reload
  const [lastCashTendered, setLastCashTendered] = useState(0);
  const [lastChange, setLastChange] = useState(0);

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
      const balance = Number(ledger?.balance || 0);
      const cash = Number(value) || 0;

      // Save what the customer actually handed over, and compute change
      const changeNow = cash > balance ? cash - balance : 0;
      setLastCashTendered(cash);
      setLastChange(changeNow);

      const toPost = Math.min(cash, balance);
      if (!toPost || toPost <= 0) return;

      await axios.post(`${API}/api/credits/${id}/payments/`, {
        amount: toPost,
        method,
        note,
        recorded_by: ledger?.handled_by || "",
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

  const balance = Number(ledger.balance || 0);
  const total = Number(ledger.total_amount || 0);
  const paid = Number(ledger.amount_paid || 0);
  const numericAmount = Number(amount || 0);

  // Button visibility logic
  const showPartial = numericAmount > 0 && numericAmount < balance;
  // Only show Full Pay when there is a positive balance AND amount covers it
  const showFull = numericAmount >= balance && balance > 0;

  // Live previews while typing
  const appliedPayment = Math.max(0, Math.min(numericAmount, balance));
  const liveChange = numericAmount > balance && balance > 0 ? numericAmount - balance : 0;
  const paidAfter = paid + appliedPayment;
  const newBalance = Math.max(0, balance - appliedPayment);

  // Paid display priority:
  // 1) current typed amount, 2) last cash tendered (from last submitted payment), 3) ledger paid
  const paidDisplay =
    numericAmount > 0 ? numericAmount : lastCashTendered > 0 ? lastCashTendered : paid;

  const handleEnter = (e) => {
    if (e.key !== "Enter") return;
    if (balance <= 0) return;
    if (showPartial) {
      addPayment(numericAmount, "cash");
    } else if (showFull) {
      addPayment(Math.max(balance, numericAmount), "cash", "Full payment");
    }
  };

  const handleAmountChange = (e) => {
    setAmount(e.target.value);
    // Clear persisted values once the user starts typing a new amount
    setLastCashTendered(0);
    setLastChange(0);
  };

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

      {/* Summary with live previews + persisted change after full pay */}
      <div className="border rounded p-4 space-y-2 text-sm">
        <div><strong>Total:</strong> ₱{fmt(total)}</div>

        {/* Paid shows typed amount or last cash tendered */}
        <div><strong>Paid:</strong> ₱{fmt(paidDisplay)}</div>

        {/* After fully paying (balance = 0) show last change, if any */}
        {balance <= 0 && lastChange > 0 && (
          <div className="text-blue-700"><strong>Change:</strong> ₱{fmt(lastChange)}</div>
        )}

        {/* While typing with remaining balance, show live previews */}
        {numericAmount > 0 && balance > 0 && (
          <>
            <div><strong>Paid (after):</strong> ₱{fmt(paidAfter)}</div>
            <div><strong>New Balance (after):</strong> ₱{fmt(newBalance)}</div>
            {liveChange > 0 && (
              <div className="text-blue-700"><strong>Change:</strong> ₱{fmt(liveChange)}</div>
            )}
          </>
        )}

        <div><strong>Balance:</strong> ₱{fmt(balance)}</div>
      </div>

      <div className="border rounded p-4 space-y-3">
        <div className="font-semibold">Add Payment</div>

        <div className="flex gap-2 items-start">
          <input
            type="number"
            step="0.01"
            className="border rounded px-2 py-1"
            value={amount}
            placeholder="Amount"
            min="0"
            onChange={handleAmountChange}
            onKeyDown={handleEnter}
            disabled={balance <= 0}
          />

          {/* Partial Pay button: only when 0 < amount < balance */}
          {showPartial && (
            <button
              className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-60"
              onClick={() => addPayment(numericAmount, "cash")}
            >
              Partial Pay
            </button>
          )}

          {/* Fully Pay button: only when there is an outstanding balance AND amount >= balance */}
          {showFull && (
            <button
              className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
              onClick={() =>
                addPayment(Math.max(balance, numericAmount), "cash", "Full payment")
              }
            >
              Fully Pay
            </button>
          )}
        </div>

        {/* helper text */}
        {numericAmount > balance && balance > 0 && (
          <div className="text-xs text-gray-700 mt-1">
            Entered amount exceeds remaining balance. <strong>Change:</strong> ₱{fmt(liveChange)}
          </div>
        )}
        {numericAmount > 0 && numericAmount <= balance && balance > 0 && showFull && (
          <div className="text-xs text-gray-600 mt-1">
            Paying exactly the balance will fully settle this credit.
          </div>
        )}
        {balance <= 0 && (
          <div className="text-xs text-green-700 mt-1">
            This credit is already fully paid.
          </div>
        )}
      </div>
    </div>
  );
}
