// src/pages/CreditDetail.jsx
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useParams, Link, useSearchParams } from "react-router-dom";
import api from "../api"; // ✅ correct


const API = "http://localhost:8080";

export default function CreditDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [ledger, setLedger] = useState(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [currentWarehouse, setCurrentWarehouse] = useState(null);

  // Persist info
  const [lastCashTendered, setLastCashTendered] = useState(0);
  const [lastChange, setLastChange] = useState(0);
  const [merch, setMerch] = useState(null); // ✅ add here

  // -------------------- Helpers --------------------
  const fmt = (v) => Number(v || 0).toFixed(2);

  const formatLocalToManila = (localStr) => {
    if (!localStr) return "--";
    const d = new Date(localStr);
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  };

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

  // -------------------- Load data --------------------
  useEffect(() => {
    const warehouse = getCurrentWarehouse();
    setCurrentWarehouse(warehouse);
  }, [getCurrentWarehouse]);

  const load = async () => {
    if (!currentWarehouse) return;
    try {
      setError("");
      const warehouseParam = searchParams.get("warehouse") || currentWarehouse.id;
      const { data } = await api.get(`/credits/${id}/?warehouse=${warehouseParam}`);
      setLedger(data);
    } catch (e) {
      console.error(e);
      setError("Failed to load credit receipt or access denied.");
    }
  };

    // ✅ Fetch merchandising record that matches this ledger's MSP number exactly
  const loadMerch = async () => {
    if (!ledger?.msp_no) return;
    try {
      const { data } = await api.get(`/merchandisings/?msp_no=${ledger.msp_no}`);
      if (Array.isArray(data) && data.length > 0) {
        // Find the record that exactly matches the current MSP No (case-insensitive)
        const match = data.find(
          (item) => String(item.msp_no).toLowerCase() === String(ledger.msp_no).toLowerCase()
        );
        if (match) {
          setMerch(match); // ✅ only this MSP No
        } else {
          setMerch(null); // no match found
        }
      } else {
        setMerch(null);
      }
    } catch (err) {
      console.error("Failed to load merchandising details:", err);
      setMerch(null);
    }
  };


  useEffect(() => {
    if (currentWarehouse) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentWarehouse]);

    useEffect(() => {
    if (ledger?.msp_no) loadMerch();
  }, [ledger]);


  // -------------------- Payment logic --------------------
  const addPayment = async (value, method = "cash", note = "") => {
    if (!currentWarehouse) return;

    try {
      const balance = Number(ledger?.balance || 0);
      const cash = Number(value) || 0;
      const changeNow = cash > balance ? cash - balance : 0;

      setLastCashTendered(cash);
      setLastChange(changeNow);

      const toPost = Math.min(cash, balance);
      if (!toPost || toPost <= 0) return;

      const warehouseParam = searchParams.get("warehouse") || currentWarehouse.id;
      await api.post(`/credits/${id}/payments/?warehouse=${warehouseParam}`, {
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
      <div className="flex justify-center items-center h-full text-red-600">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">No Warehouse Selected</h2>
          <p>Please select a warehouse to view credit details.</p>
        </div>
      </div>
    );
  }

  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!ledger) return <div className="p-4">Loading…</div>;

  // -------------------- Totals --------------------
  const rows = ledger?.rows_json || ledger?.rows || [];
  const ledgerDiscNonEmpty = rows.reduce(
  (sum, r) =>
    sum +
    Number(r.discrepancy_full_shell ?? 0) * Number(r.empty_price_shell ?? 0) +
    Number(r.discrepancy_full_pcs ?? 0) * Number(r.empty_price_pc ?? 0),
  0
);

  const totalEmptyAmount = rows.reduce((sum, r) => {
    const shellPrice = Number(r.shellPrice ?? r.shell_price ?? 0);
    const bottlePrice = Number(r.bottlePrice ?? r.bottle_price ?? 0);
    const soldShell = Number(r.sold_shell ?? r.soldShell ?? 0);
    const soldPcs = Number(r.sold_pcs ?? r.soldPcs ?? 0);
    return sum + (soldShell * shellPrice + soldPcs * bottlePrice);
  }, 0);

  const totalReturnedAmount = rows.reduce((sum, r) => {
    const shellPrice = Number(r.shellPrice ?? r.shell_price ?? 0);
    const bottlePrice = Number(r.bottlePrice ?? r.bottle_price ?? 0);
    const retShell = Number(r.expectedReturnShellEmpty ?? r.return_shell_empty ?? r.empty_return_shell ?? 0);
    const retPcs = Number(r.expectedReturnPcsEmpty ?? r.return_pcs_empty ?? r.empty_return_pcs ?? 0);
    return sum + (retShell * shellPrice + retPcs * bottlePrice);
  }, 0);

  const totalDiscAmount = rows.reduce((sum, r) => {
    const shellPrice = Number(r.shellPrice ?? r.shell_price ?? 0);
    const bottlePrice = Number(r.bottlePrice ?? r.bottle_price ?? 0);
    const discShell = Number(r.discrepancyShellEmpty ?? r.disc_shell_empty ?? r.discrepancy_empties_shell ?? 0);
    const discPcs = Number(r.discrepancyPcsEmpty ?? r.disc_pcs_empty ?? r.discrepancy_empties_pc ?? 0);
    return sum + (discShell * shellPrice + discPcs * bottlePrice);
  }, 0);

    // -------------------- Totals --------------------
  const total = Number(ledger.total_amount ?? ledger.total_trading_amount ?? 0);
  const paid = Number(ledger.amount_paid ?? ledger.cash_received ?? 0);
  const balance = Number(ledger.balance ?? total - paid);
                          // remaining balance

  const numericAmount = Number(amount || 0);
  const statusNorm = String(ledger?.status ?? "").trim().toLowerCase();
  const isPaid = statusNorm === "paid";

  const showPartial = numericAmount > 0 && numericAmount < balance;
  const showFull = numericAmount >= balance && balance > 0;
  const appliedPayment = Math.max(0, Math.min(numericAmount, balance));
  const liveChange = numericAmount > balance && balance > 0 ? numericAmount - balance : 0;
  const paidAfter = paid + appliedPayment;
  const newBalance = Math.max(0, balance - appliedPayment);

  const handleEnter = (e) => {
    if (e.key !== "Enter") return;
    if (balance <= 0) return;
    if (showPartial) addPayment(numericAmount, "cash");
    else if (showFull) addPayment(Math.max(balance, numericAmount), "cash", "Full payment");
  };

  const handleAmountChange = (e) => {
    setAmount(e.target.value);
    setLastCashTendered(0);
    setLastChange(0);
  };

  // -------------------- Render --------------------
  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Credit Receipt - {ledger.warehouse_name}</h1>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${isPaid ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{ledger.status}</span>
      </div>

      {/* META */}
      <div className="grid grid-cols-2 gap-6 bg-white p-4 rounded-lg shadow">
        <div className="space-y-1">
          <p><strong>MSP No:</strong> {ledger.msp_no}</p>
          <p><strong>Date:</strong> {formatLocalToManila(ledger.created_at)}</p>
          <p><strong>Handled By:</strong> {ledger.handled_by || "--"}</p>
        </div>
        <div className="space-y-1 text-right">
          <p><strong>Customer:</strong> {ledger.customer_name}</p>
          <p><strong>Due Date:</strong> {ledger.due_date ? formatLocalToManila(ledger.due_date) : "--"}</p>
        </div>
      </div>

      {/* ITEMS TABLE */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <div className="px-4 py-2 font-semibold bg-gray-100">Items</div>
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="p-2 border">Product</th>
              <th className="p-2 border">Sold Shell</th>
              <th className="p-2 border">Sold PC</th>
              <th className="p-2 border">Unit Price</th>
              <th className="p-2 border">Discount %</th>
              <th className="p-2 border">Empty Price</th>
              <th className="p-2 border">Returned (Empty)</th>
              <th className="p-2 border">Discrepancy (Empty)</th>
              <th className="p-2 border">Returned (With Content/s)</th>
              <th className="p-2 border">Discrepancy (Non-empty)</th>
              <th className="p-2 border">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) => {
                // Hide rows that have no valid product name and zero values
                const hasName = (r.productName || r.product_name || "").trim() !== "--" && (r.productName || r.product_name);
                const soldShell = Number(r.sold_shell ?? r.soldShell ?? 0);
                const soldPcs = Number(r.sold_pcs ?? r.soldPcs ?? 0);
                const actualSale = Number(r.actualSale ?? r.actual_sale ?? r.total ?? r.line_total ?? r.lineTotal ?? 0);
                const anyValue = soldShell > 0 || soldPcs > 0 || actualSale > 0;
                return hasName || anyValue; // ✅ Only show if there’s actual data
              })
              .map((r, i) => {
              const shellPrice = Number(r.shellPrice ?? r.shell_price ?? 0);
              const bottlePrice = Number(r.bottlePrice ?? r.bottle_price ?? 0);
              const soldShell = Number(r.sold_shell ?? r.soldShell ?? 0);
              const soldPcs = Number(r.sold_pcs ?? r.soldPcs ?? r.qty ?? r.quantity ?? 0);
              const retShell = Number(r.expectedReturnShellEmpty ?? r.return_shell_empty ?? r.empty_return_shell ?? 0);
              const retPcs = Number(r.expectedReturnPcsEmpty ?? r.return_pcs_empty ?? r.empty_return_pcs ?? 0);
              const discShell = Number(r.discrepancyShellEmpty ?? r.disc_shell_empty ?? r.discrepancy_empties_shell ?? 0);
              const discPcs = Number(r.discrepancyPcsEmpty ?? r.disc_pcs_empty ?? r.discrepancy_empties_pc ?? 0);
              const actualSale = Number(r.actualSale ?? r.actual_sale ?? r.total ?? r.line_total ?? r.lineTotal ?? 0);

              const emptyPriceShell = Number(r.empty_price_shell ?? 0);
              const emptyPricePc = Number(r.empty_price_pc ?? 0);

              const emptyAmount = soldShell * emptyPriceShell + soldPcs * emptyPricePc;
              const returnedAmount = retShell * emptyPriceShell + retPcs * emptyPricePc;
              const discAmount = discShell * emptyPriceShell + discPcs * emptyPricePc;

              const discNonEmpty =
                Number(r.discrepancy_full_shell ?? 0) * Number(r.empty_price_shell ?? 0) +
                Number(r.discrepancy_full_pcs ?? 0) * Number(r.empty_price_pc ?? 0);



              return (
                <tr key={i} className="border-t hover:bg-gray-50">
                  <td className="p-2 border">{r.productName || r.product_name || "--"}</td>
                  <td className="p-2 border">{soldShell}</td>
                  <td className="p-2 border">{soldPcs}</td>
                  <td className="p-2 border">₱{fmt(Number(r.unitPrice ?? r.selling_price ?? r.price ?? 0))}</td>
                  <td className="p-2 border">{fmt(r.discount_percent ?? r.discount ?? 0)}</td>
                  <td className="p-2 border font-semibold">
                      ₱{fmt(merch?.empties_price_total ?? emptyAmount)}
                    </td>
                    <td className="p-2 border text-green-700 font-semibold">
                      ₱{fmt(merch?.empty_returns ?? returnedAmount)}
                    </td>
                    <td
                      className={`p-2 border font-semibold ${
                        (merch?.discrepancy_empty ?? discAmount) !== 0 ? "text-red-600" : "text-gray-500"
                      }`}
                    >
                      ₱{fmt(merch?.discrepancy_empty ?? discAmount)}
                    </td>
                    <td className="p-2 border font-semibold text-blue-600">
                      ₱{fmt(merch?.returned_with_content ?? r.returnedWithContent ?? 0)}
                    </td>


                  <td className="p-2 border font-semibold text-red-600">
                    ₱{fmt(merch?.discrepancy_non_empty ?? discNonEmpty)}
                  </td>
                  <td className="p-2 border font-bold text-blue-700">₱{fmt(actualSale)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-xl font-bold text-blue-700">₱{fmt(total)}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-500">Paid</p>
          <p className="text-xl font-bold text-green-600">₱{fmt(paid)}</p>
        </div>
        <div className={`rounded-lg p-4 text-center ${balance > 0 ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
          <p className="text-sm text-gray-500">Balance</p>
          <p className={`text-xl font-bold ${balance > 0 ? "text-red-600" : "text-green-700"}`}>₱{fmt(balance)}</p>
        </div>
      </div>

      {/* ADD PAYMENT */}
      {!isPaid && (
        <div className="bg-white border rounded-lg shadow p-6 space-y-4">
          <h2 className="font-semibold text-lg text-gray-700">Add Payment</h2>
          <div className="flex gap-3 items-start">
            <input
              type="number"
              step="0.01"
              className="border rounded px-3 py-2 bg-yellow-50 w-48"
              value={amount}
              placeholder="Amount"
              min="0"
              onChange={handleAmountChange}
              onKeyDown={handleEnter}
              disabled={balance <= 0}
            />
            {showPartial && (
              <button
                className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                onClick={() => addPayment(numericAmount, "cash")}
              >
                Partial Pay
              </button>
            )}
            {showFull && (
              <button
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() =>
                  addPayment(Math.max(balance, numericAmount), "cash", "Full payment")
                }
              >
                Fully Pay
              </button>
            )}
          </div>

          {/* 🔹 Live preview while typing */}
          {numericAmount > 0 && balance > 0 && (
            <div className="mt-4 space-y-1 text-sm">
              <div>
                <strong>Paid (after):</strong>{" "}
                <span className="text-green-700">₱{fmt(paidAfter)}</span>
              </div>
              <div>
                <strong>New Balance (after):</strong>{" "}
                <span
                  className={`font-semibold ${newBalance > 0 ? "text-red-600" : "text-gray-600"}`}
                >
                  ₱{fmt(newBalance)}
                </span>
              </div>
              {liveChange > 0 && (
                <div>
                  <strong>Change:</strong>{" "}
                  <span className="text-blue-700 font-semibold">
                    ₱{fmt(liveChange)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* BACK */}
      <div className="flex justify-end">
        <Link
          to="/credits"
          className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
        >
          Back
        </Link>
      </div>
    </div>
  );
}