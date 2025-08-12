import React, { useState, useMemo } from "react";
import InvoiceModal from "./InvoiceModal";

const PaymentModal = ({
  open,
  onClose,
  onConfirm,
  onSave,
  onPaymentSuccess,

  // data
  rows = [],

  // money coming from parent (falls back to recompute if missing)
  amountDue = 0,
  totalAmount = 0,
  actualSales = 0,
  emptiesPriceTotal = 0,
  emptyReturns = 0,
  emptyDiscrepancies = 0,

  // header info
  mspNo,
  customerName,
  handledBy,
  transactionDate,

  // Van Load extras
  transactionTypeName, // "Warehouse" | "Van Load"
  expensesTotal = 0,
  remarks = "",
  onRemarksChange,
}) => {
  // ------------ hooks ------------
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("30 Days");
  const [creditNotes, setCreditNotes] = useState("");
  const [invoiceData, setInvoiceData] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ------------ helpers ------------
  const n = (v) => Number(v || 0);
  const fmt = (v) => n(v).toFixed(2);

  // robust “Van Load” check (tolerates spaces/case)
  const isVanLoad = /van\s*load/i.test(String(transactionTypeName || ""));
  const isWarehouse = /warehouse/i.test(String(transactionTypeName || ""));

  const getDaysFromTerm = (term) => {
    const num = parseInt(term, 10);
    return Number.isNaN(num) ? 30 : num;
  };
  const days = getDaysFromTerm(paymentTerms);
  const paymentDueDate = new Date();
  paymentDueDate.setDate(paymentDueDate.getDate() + days);
  const formattedDueDate = paymentDueDate.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const formatLocalToManila = (localStr) => {
    if (!localStr) return "";
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

  // ---- robust accessors ----
  const pickNum = (...vals) => {
    for (const v of vals) {
      if (v !== "" && v !== null && v !== undefined) {
        const num = Number(v);
        if (!Number.isNaN(num)) return num;
      }
    }
    return 0;
  };

  const getProdName = (row) =>
    row.productName || row.product_name || row.product_detail?.product_name || "—";
  const getSoldShell = (row) => pickNum(row.sold_shell, row.soldShell);
  const getSoldPcs = (row) => pickNum(row.sold_pcs, row.soldPcs, row.qty, row.quantity);
  const getUnitPrice = (row) => pickNum(row.unitPrice, row.selling_price, row.price);
  const getEmptyShellPrice = (row) =>
    pickNum(row.empty_price_shell, row.emptyPriceShell, row.shellPrice);
  const getDiscountPercent = (row) => pickNum(row.discount_percent, row.discount);
  const getDiscountAmount = (row) => pickNum(row.discount_amount, row.discount_amt);
  const getDirectTotal = (row) =>
    pickNum(row.actualSale, row.actual_sale, row.total, row.line_total, row.lineTotal);

  // Compute a line total if not directly provided
  const getLineTotal = (row) => {
    const direct = getDirectTotal(row);
    if (direct) return direct;

    const pcs = getSoldPcs(row);
    const shell = getSoldShell(row);
    const price = getUnitPrice(row);

    if (isWarehouse) {
      // Warehouse: price * pcs - discount
      const discPct = getDiscountPercent(row);
      const discAmtFromPct = (price * pcs * discPct) / 100;
      const discAmt = getDiscountAmount(row) || discAmtFromPct;
      return Number((pcs * price - discAmt).toFixed(2));
    }

    // Van Load: (pcs*unit + shell*emptyShell) * (1 - discount%)
    const emptyShellPrice = getEmptyShellPrice(row);
    const discPct = getDiscountPercent(row);
    const gross = pcs * price + shell * emptyShellPrice;
    return Number((gross * (1 - discPct / 100)).toFixed(2));
  };

  // Filter out blank/placeholder rows
  const tableRows = (rows || []).filter(
    (r) =>
      getProdName(r) !== "—" ||
      getSoldPcs(r) > 0 ||
      getSoldShell(r) > 0 ||
      getUnitPrice(r) > 0
  );

  // Modal "Actual Sales" fallback: recompute from rows if parent didn't pass
  const actualSalesValue = useMemo(() => {
    const fromParent = n(actualSales);
    if (fromParent > 0) return fromParent;
    return tableRows.reduce((sum, r) => sum + getLineTotal(r), 0);
  }, [actualSales, tableRows]);

  // ---- THE IMPORTANT PART: compute a consistent total due inside the modal ----
  const computedTotalDue = useMemo(() => {
    const base =
      n(actualSalesValue) -
      n(emptiesPriceTotal) -
      n(emptyReturns) -
      n(emptyDiscrepancies) -
      (isVanLoad ? n(expensesTotal) : 0);
    // never negative
    return Math.max(base, 0);
  }, [
    actualSalesValue,
    emptiesPriceTotal,
    emptyReturns,
    emptyDiscrepancies,
    expensesTotal,
    isVanLoad,
  ]);

  // Prefer parent values only if they’re explicitly positive
  const amountDueFinal = n(amountDue) > 0 ? n(amountDue) : computedTotalDue;
  const totalAmountFinal = n(totalAmount) > 0 ? n(totalAmount) : computedTotalDue;

  const showChange = String(cashReceived).trim() !== "";
  const change = Math.max(n(cashReceived) - amountDueFinal, 0);

  // ------------- early return AFTER hooks -------------
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-30 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg w-full max-w-4xl shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="border-b pb-2 mb-4">
          <h2 className="text-xl font-bold">Payment Confirmation</h2>
        </div>

        {/* Header Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>MSP No.</strong>: {mspNo || "—"}
          </div>
          <div>
            <strong>Date</strong>: {formatLocalToManila(transactionDate) || "—"}
          </div>
          <div>
            <strong>Customer</strong>: {customerName || "Walk-in"}
          </div>
          <div>
            <strong>Handled By</strong>: {handledBy || "—"}
          </div>
        </div>

        {/* Product Summary */}
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Products Summary</h3>
          <table className="w-full mt-4 border">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-2 text-left">Product</th>
                <th className="p-2 text-left">Sold Qty (Shell)</th>
                <th className="p-2 text-left">Sold Qty (PC)</th>
                <th className="p-2 text-left">Unit Price</th>
                <th className="p-2 text-left">Discount (%)</th>
                <th className="p-2 text-left">Total</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, index) => (
                <tr key={index} className="border-t">
                  <td className="p-2">{getProdName(row)}</td>
                  <td className="p-2">{getSoldShell(row)}</td>
                  <td className="p-2">{getSoldPcs(row)}</td>
                  <td className="p-2">₱{fmt(getUnitPrice(row))}</td>
                  <td className="p-2">{fmt(getDiscountPercent(row))}</td>
                  <td className="p-2">₱{fmt(getLineTotal(row))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Payment Breakdown */}
        <div className="mt-6 text-sm">
          <h3 className="font-semibold mb-2">Payment Breakdown</h3>
          <div className="border p-4 rounded space-y-2">
            <div>
              <strong>Actual Sales:</strong> ₱{fmt(actualSalesValue)}
            </div>
            <div className="ml-4">- Empties Price Total: ₱{fmt(emptiesPriceTotal)}</div>
            <div className="ml-4">- Empty Returns: ₱{fmt(emptyReturns)}</div>
            <div className="ml-4">- Empty Discrepancies: ₱{fmt(emptyDiscrepancies)}</div>
            {isVanLoad && <div className="ml-4">- Expenses: ₱{fmt(expensesTotal)}</div>}
            <div className="text-blue-600 font-bold">
              Total Amount Due: ₱{fmt(totalAmountFinal)}
            </div>
          </div>
        </div>

        {/* Van Load only: Remarks */}
        {isVanLoad && (
          <div className="mt-4">
            <label className="block text-sm font-semibold mb-1">Remarks (Van Load)</label>
            <textarea
              rows={3}
              className="w-full border rounded px-2 py-1"
              value={remarks}
              onChange={(e) => (onRemarksChange ? onRemarksChange(e.target.value) : null)}
              placeholder="Add remarks for this Van Load transaction..."
            />
          </div>
        )}

        {/* Payment Method */}
        <div className="mt-6 text-sm">
          <h3 className="font-semibold mb-2">Payment Method</h3>
          <div className="flex gap-4 mb-4">
            {["cash", "credit", "bank"].map((method) => (
              <button
                key={method}
                className={`px-4 py-2 rounded border ${
                  paymentMethod === method ? "bg-blue-500 text-white" : "bg-gray-100"
                }`}
                onClick={() => setPaymentMethod(method)}
              >
                {method === "cash" ? "Cash" : method === "credit" ? "Credit" : "E-wallet"}
              </button>
            ))}
          </div>

          {paymentMethod === "cash" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1">Cash Amount Received</label>
                <input
                  type="number"
                  className="w-full border rounded px-2 py-1"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                />
              </div>
              <div>
                <label className="block mb-1">Amount Due</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  value={`₱${fmt(amountDueFinal)}`}
                  readOnly
                />
              </div>
              {showChange && (
                <div>
                  <label className="block mb-1">Change</label>
                  <input
                    className="w-full border rounded px-2 py-1"
                    value={`₱${fmt(change)}`}
                    readOnly
                  />
                </div>
              )}
            </div>
          )}

          {paymentMethod === "credit" && (
            <div className="border p-4 rounded space-y-4">
              <div>
                <h4 className="font-semibold text-blue-600 mb-2">📅 Credit Terms</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1">Payment Terms (Days)</label>
                    <select
                      className="w-full border rounded px-2 py-1"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                    >
                      <option>7 Days</option>
                      <option>15 Days</option>
                      <option>30 Days</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1">Payment Due Date</label>
                    <input
                      type="text"
                      className="w-full border rounded px-2 py-1"
                      value={formattedDueDate}
                      readOnly
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block mb-1">Credit Notes (Optional)</label>
                <textarea
                  rows="3"
                  className="w-full border rounded px-2 py-1"
                  placeholder="Add any special arrangements or notes for this credit transaction..."
                  value={creditNotes}
                  onChange={(e) => setCreditNotes(e.target.value)}
                />
              </div>

              <div className="bg-blue-100 border border-blue-300 p-4 rounded">
                <div className="font-semibold text-blue-700">Credit Amount:</div>
                <div className="flex justify-between items-center mt-1 text-sm">
                  <div>
                    <div>
                      <strong>Customer:</strong> {customerName || "Walk-in"}
                    </div>
                    <div>
                      <strong>Due:</strong> {formattedDueDate}
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-blue-800">
                    ₱{fmt(totalAmountFinal)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="mt-6 flex justify-between">
          <button className="border px-4 py-2 rounded" onClick={onClose} disabled={submitting}>
            Back to Sale
          </button>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
            disabled={submitting || (paymentMethod === "cash" && n(cashReceived) < amountDueFinal)}
            onClick={async () => {
              const data = {
                // payment
                paymentMethod,
                amount: n(cashReceived || totalAmountFinal),
                cashReceived: n(cashReceived),
                change,
                amountDue: amountDueFinal,

                // breakdown
                actualSales: n(actualSalesValue),
                emptiesPriceTotal: n(emptiesPriceTotal),
                emptyReturns: n(emptyReturns),
                emptyDiscrepancies: n(emptyDiscrepancies),
                expensesTotal: n(expensesTotal),
                totalAmount: totalAmountFinal,

                // rows + headers
                rows,
                mspNo,
                customerName,
                handledBy,
                transactionDate,

                // van load extras
                transactionTypeName,
                remarks,
              };

              const paymentOk = paymentMethod === "cash" ? n(cashReceived) >= amountDueFinal : true;

              try {
                setSubmitting(true);

                if (isVanLoad && paymentOk && typeof onPaymentSuccess === "function") {
                  await onPaymentSuccess(data);
                }

                if (typeof onConfirm === "function") {
                  await onConfirm(data);
                }

                if (typeof onSave === "function") {
                  await onSave();
                }

                setInvoiceData(data);
                setShowInvoiceModal(true);
              } catch (e) {
                console.error(e);
                alert("Payment save failed. Please try again.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? "Processing..." : "Confirm Payment & Generate Invoice"}
          </button>
        </div>
      </div>

      {showInvoiceModal && (
        <InvoiceModal
          onClose={() => {
            setShowInvoiceModal(false);
            if (typeof onClose === "function") onClose();
          }}
          invoiceData={invoiceData}
        />
      )}
    </div>
  );
};

export default PaymentModal;
