// src/pages/CreditDetail.jsx
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useParams, Link, useSearchParams } from "react-router-dom";

const API = "http://localhost:8080";

export default function CreditDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [ledger, setLedger] = useState(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [currentWarehouse, setCurrentWarehouse] = useState(null);

  // Persist info so it's visible even after full payment/reload
  const [lastCashTendered, setLastCashTendered] = useState(0);
  const [lastChange, setLastChange] = useState(0);

  // Get current warehouse information
  const getCurrentWarehouse = useCallback(() => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    
    if (userData.role?.toLowerCase() === "admin") {
      return selectedWarehouse || { id: userData.warehouse_id, name: userData.warehouse };
    }
    
    if (userData.warehouse_id && userData.warehouse) {
      return { id: userData.warehouse_id, name: userData.warehouse };
    }
    
    return null;
  }, []);

  useEffect(() => {
    const warehouse = getCurrentWarehouse();
    setCurrentWarehouse(warehouse);
  }, [getCurrentWarehouse]);

  const load = async () => {
    if (!currentWarehouse) return;

    try {
      setError("");
      const warehouseParam = searchParams.get('warehouse') || currentWarehouse.id;
      const { data } = await axios.get(`${API}/api/credits/${id}/?warehouse=${warehouseParam}`);
      setLedger(data);
    } catch (e) {
      console.error(e);
      setError("Failed to load credit receipt or access denied.");
    }
  };

  useEffect(() => {
    if (currentWarehouse) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentWarehouse]);

  const fmt = (v) => Number(v || 0).toFixed(2);

  const addPayment = async (value, method = "cash", note = "") => {
    if (!currentWarehouse) return;

    try {
      const balance = Number(ledger?.balance || 0);
      const cash = Number(value) || 0;

      // Save what the customer actually handed over, and compute change
      const changeNow = cash > balance ? cash - balance : 0;
      setLastCashTendered(cash);
      setLastChange(changeNow);

      const toPost = Math.min(cash, balance);
      if (!toPost || toPost <= 0) return;

      const warehouseParam = searchParams.get('warehouse') || currentWarehouse.id;
      await axios.post(`${API}/api/credits/${id}/payments/?warehouse=${warehouseParam}`, {
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

  if (!currentWarehouse) {
    return (
      <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--danger)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Warehouse Selected</h2>
          <p>Please select a warehouse to view credit details.</p>
        </div>
      </div>
    );
  }

  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!ledger) return <div className="p-4">Loading…</div>;

  const balance = Number(ledger.balance || 0);
  const total = Number(ledger.total_amount || 0);
  const paid = Number(ledger.amount_paid || 0);
  const numericAmount = Number(amount || 0);

  // Normalize status to avoid casing/whitespace mismatches
  const statusNorm = String(ledger?.status ?? "").trim().toLowerCase();
  const isPaid = statusNorm === "paid";

  // Button visibility logic
  const showPartial = numericAmount > 0 && numericAmount < balance;
  const showFull = numericAmount >= balance && balance > 0;

  // Live previews while typing
  const appliedPayment = Math.max(0, Math.min(numericAmount, balance));
  const liveChange = numericAmount > balance && balance > 0 ? numericAmount - balance : 0;
  const paidAfter = paid + appliedPayment;
  const newBalance = Math.max(0, balance - appliedPayment);

  // Paid display priority:
  // 1) current typed amount, 2) last cash tendered, 3) ledger paid
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
    setLastCashTendered(0);
    setLastChange(0);
  };

  return (
    <div className="p-4 space-y-6">
      <div className="receiving-receipt-header">
        <h1 className="page-title">Credit Receipt - {ledger.warehouse_name}</h1>
      </div>

      <div className="receipt-meta">
        <div className="meta-col">
          <div><strong>MSP No:</strong> {ledger.msp_no}</div>
          <div><strong>Date:</strong> {new Date(ledger.created_at).toLocaleString()}</div>
          <div><strong>Handled By:</strong> {ledger.handled_by || "--"}</div>
        </div>
        <div className="meta-col right">
          <div><strong>Customer:</strong> {ledger.customer_name}</div>
          <div><strong>Status:</strong> {ledger.status}</div>
          <div><strong>Due Date:</strong> {ledger.due_date ? new Date(ledger.due_date).toLocaleDateString() : "--"}</div>
        </div>
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
                  <td className="p-2">{r.productName || r.product_name || "--"}</td>
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
        <div><strong>Paid:</strong> ₱{fmt(paid)}</div>

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

      {/* ✅ Only show Add Payment if status is NOT "Paid" */}
      {!isPaid && (
        <div className="border rounded p-4 space-y-3">
          <div className="font-semibold">Add Payment</div>

          <div className="flex gap-2 items-start">
            <input
              type="number"
              step="0.01"
              className="border rounded px-2 py-1 bg-yellow-50 input-always-spinner"
              value={amount}
              placeholder="Amount"
              min="0"
              onChange={handleAmountChange}
              onKeyDown={handleEnter}
              disabled={balance <= 0}
            />

            {showPartial && (
              <button
                className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-60"
                onClick={() => addPayment(numericAmount, "cash")}
              >
                Partial Pay
              </button>
            )}

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
      )}
       <div className="flex justify-end">
            <Link to="/credits" className="btn btn-back">Back</Link>
      </div>
    </div>
  );
}