// src/components/PaymentModal.jsx
import React, { useState, useMemo } from "react";
import InvoiceModal from "./InvoiceModal";
import axios from "axios";

// ---- Helper to create a Credit Ledger on the backend (POST /api/credits/) ----
async function createCreditLedgerFromModalPayload(payload) {
  if (payload.paymentMethod !== "credit") return null;

  const body = {
    msp_no: payload.mspNo,
    customerName: payload.customerName,
    handledBy: payload.handledBy,
    transactionTypeName: payload.transactionTypeName,
    remarks: payload.remarks || "",
    payment_terms_days: payload.paymentTermsDays, // 7/15/30
    due_date: payload.dueDate, // ISO string
    amountDue: payload.amountDue,
    totalAmount: payload.totalAmount,
    rows: payload.rows || [],
    transactionDate: payload.transactionDate || new Date().toISOString(),
    creditNotes: payload.creditNotes || "",
  };

  try {
    const res = await axios.post("http://127.0.0.1:8080/api/credits/", body);
    return res.data;
  } catch (err) {
    throw err;
  }
}

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

  // van load breakdown props
  expectedSale = 0,
  totalReturnedWithContent = 0,
  totalDiscrepancyNonEmpty = 0,
  totalActualRetrievedVL = 0,
  overallTotalVL = 0,
  grandTotalVL = 0,
  transactionTypes = "",

  miscItems = [],
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
  const peso = (v) =>
    `₱${n(v).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const isVanLoad = /van\s*load/i.test(String(transactionTypeName || ""));
  const isWarehouse = /warehouse/i.test(String(transactionTypeName || ""));

  const getDaysFromTerm = (term) => {
    const num = parseInt(term, 10);
    return Number.isNaN(num) ? 30 : num;
  };
  const days = getDaysFromTerm(paymentTerms);
  const paymentDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  }, [days]);

  const formattedDueDate = useMemo(
    () =>
      paymentDueDate.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    [paymentDueDate]
  );

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
  const tableRows = useMemo(
    () =>
      (rows || []).filter(
        (r) =>
          getProdName(r) !== "—" ||
          getSoldPcs(r) > 0 ||
          getSoldShell(r) > 0 ||
          getUnitPrice(r) > 0
      ),
    [rows]
  );

  // Modal "Actual Sales" fallback
  const actualSalesValue = useMemo(() => {
    const fromParent = n(actualSales);
    if (fromParent > 0) return fromParent;
    return tableRows.reduce((sum, r) => sum + getLineTotal(r), 0);
  }, [actualSales, tableRows]);

  // ---- Compute a consistent total due inside the modal ----
  const computedTotalDue = useMemo(() => {
    const base =
      n(actualSalesValue) -
      n(emptiesPriceTotal) -
      n(emptyReturns) -
      n(emptyDiscrepancies) -
      (isVanLoad ? n(expensesTotal) : 0);
    return Math.max(base, 0);
  }, [
    actualSalesValue,
    emptiesPriceTotal,
    emptyReturns,
    emptyDiscrepancies,
    expensesTotal,
    isVanLoad,
  ]);

  // ---- VAN LOAD totals (with safe fallbacks) ----
  const vl_actual = n(actualSalesValue);
  const vl_retWc = n(totalReturnedWithContent);
  const vl_discNE = n(totalDiscrepancyNonEmpty);
  const vl_discE = n(emptyDiscrepancies);

  const vl_totalActualRetrieved =
    n(totalActualRetrievedVL) || vl_actual + vl_retWc + vl_discNE;

  const vl_overallTotal = n(overallTotalVL) || vl_actual + vl_discE + vl_discNE;

  const vl_grandTotal = n(grandTotalVL) || vl_overallTotal - n(expensesTotal);

  // Prefer parent values only if they’re explicitly positive
  const amountDueFinal = isVanLoad
    ? vl_grandTotal
    : n(amountDue) > 0
    ? n(amountDue)
    : computedTotalDue;

  const totalAmountFinal = isVanLoad
    ? vl_grandTotal
    : n(totalAmount) > 0
    ? n(totalAmount)
    : computedTotalDue;

  const showChange = String(cashReceived).trim() !== "";
  const change = Math.max(n(cashReceived) - amountDueFinal, 0);

  // ===== Totals for the two tables (memoized, eslint-safe) =====
  // Product Summary totals
  const sumExpectedSale = useMemo(
    () => tableRows.reduce((a, r) => a + n(r?.expected_sale), 0),
    [tableRows]
  );

  const sumActualSale = useMemo(
    () =>
      tableRows.reduce((a, r) => {
        const lt = typeof getLineTotal === "function" ? getLineTotal(r) : r?.line_total;
        return a + n(r?.actual_sale ?? lt);
      }, 0),
    [tableRows]
  );

  // Returnables Summary counts
  const sumEmptyRetShell = useMemo(
    () => tableRows.reduce((a, r) => a + n(r?.empty_return_shell), 0),
    [tableRows]
  );
  const sumEmptyRetPcs = useMemo(
    () => tableRows.reduce((a, r) => a + n(r?.empty_return_pcs), 0),
    [tableRows]
  );
  const sumDiscEmptyShell = useMemo(
    () => tableRows.reduce((a, r) => a + n(r?.discrepancy_empties_shell), 0),
    [tableRows]
  );
  const sumDiscEmptyPcs = useMemo(
    () => tableRows.reduce((a, r) => a + n(r?.discrepancy_empties_pc), 0),
    [tableRows]
  );
  const sumFullRetShell = useMemo(
    () => tableRows.reduce((a, r) => a + n(r?.actual_return_shell), 0),
    [tableRows]
  );
  const sumFullRetPcs = useMemo(
    () => tableRows.reduce((a, r) => a + n(r?.actual_return_pcs), 0),
    [tableRows]
  );
  const sumDiscFullShell = useMemo(
    () => tableRows.reduce((a, r) => a + n(r?.discrepancy_full_shell), 0),
    [tableRows]
  );
  const sumDiscFullPcs = useMemo(
    () => tableRows.reduce((a, r) => a + n(r?.discrepancy_full_pcs), 0),
    [tableRows]
  );

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
            <strong>Customer</strong>: {(customerName ?? "").trim() || "Walk-in"}
          </div>
          <div>
            <strong>Handled By</strong>: {handledBy || "—"}
          </div>
        </div>

        {/* Product Summary */}
        {isVanLoad ? (
          <>
            {/* ===== 1) PRODUCTS SUMMARY ===== */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Products Summary</h3>

              <table className="w-full mt-4 border">
                <thead className="bg-gray-200 text-sm text-gray-800">
                  <tr className="text-xs font-semibold">
                    <th className="p-2 text-left">Product</th>
                    <th className="p-2 text-center" colSpan={2}>
                      Dispatched
                    </th>
                    <th className="p-2 text-center" colSpan={2}>
                      Sold
                    </th>
                    <th className="p-2 text-center">Selling Price</th>
                    <th className="p-2 text-center">Discount (%)</th>
                    <th className="p-2 text-center">Expected Sale</th>
                    <th className="p-2 text-center">Actual Sale</th>
                  </tr>
                  <tr className="text-[11px] bg-gray-200">
                    <td className="p-2"></td>
                    <td className="p-1 font-medium text-center">Shell</td>
                    <td className="p-1 font-medium text-center">PCS</td>
                    <td className="p-1 font-medium text-center">Shell</td>
                    <td className="p-1 font-medium text-center">PCS</td>
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                  </tr>
                </thead>

                <tbody>
                  {tableRows.map((row, index) => {
                    const productName =
                      (typeof getProdName === "function" && getProdName(row)) ||
                      row.productName ||
                      row.product_detail?.product_name ||
                      `#${row.productId ?? index + 1}`;

                    const soldShell =
                      typeof getSoldShell === "function" ? getSoldShell(row) : row.sold_shell;
                    const soldPcs =
                      typeof getSoldPcs === "function" ? getSoldPcs(row) : row.sold_pcs;
                    const unitPrice =
                      typeof getUnitPrice === "function" ? getUnitPrice(row) : row.selling_price;
                    const discount =
                      typeof getDiscountPercent === "function"
                        ? getDiscountPercent(row)
                        : row.discount;
                    const lineTotal =
                      typeof getLineTotal === "function" ? getLineTotal(row) : row.line_total;

                    return (
                      <tr key={row.id ?? index} className="hover:bg-gray-50">
                        <td className="p-2">{productName}</td>
                        <td className="p-2 text-center">{n(row.dispatched_shell)}</td>
                        <td className="p-2 text-center">{n(row.dispatched_pcs)}</td>
                        <td className="p-2 text-center">{n(soldShell)}</td>
                        <td className="p-2 text-center">{n(soldPcs)}</td>
                        <td className="p-2 text-center">{peso(unitPrice)}</td>
                        <td className="p-2 text-center">{n(discount).toFixed(2)}</td>
                        <td className="p-2 text-center">{peso(row.expected_sale)}</td>
                        <td className="p-2 text-center">{peso(row.actual_sale ?? lineTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr className="bg-slate-100 font-semibold text-[13px]">
                    <td className="p-2 text-left">TOTAL</td>
                    {/* Dispatched & Sold – blank for clean layout */}
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    {/* Selling Price, Discount – no totals */}
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    <td className="p-2 text-center">{peso(sumExpectedSale)}</td>
                    <td className="p-2 text-center">{peso(sumActualSale)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ===== 2) RETURNABLES SUMMARY ===== */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-2">Returnables Summary</h3>

              <table className="w-full mt-4 border">
                <thead className="bg-gray-200 text-sm text-gray-800">
                  <tr className="text-xs font-semibold">
                    <th className="p-2 text-left">Product</th>
                    <th className="p-2 text-center" colSpan={2}>
                      Dispatched
                    </th>
                    <th className="p-2 text-center" colSpan={2}>
                      Empty Prices
                    </th>
                    <th className="p-2 text-center" colSpan={2}>
                      Empty: Returned
                    </th>
                    <th className="p-2 text-center" colSpan={2}>
                      Empty: Discrepancy
                    </th>
                    <th className="p-2 text-center">With Contents: Selling Price</th>
                    <th className="p-2 text-center" colSpan={2}>
                      With Contents: Returned
                    </th>
                    <th className="p-2 text-center" colSpan={2}>
                      With Contents: Discrepancy
                    </th>
                  </tr>
                  <tr className="text-[11px] bg-gray-200">
                    <td className="p-2"></td>
                    <td className="p-1 font-medium text-center">Shell</td>
                    <td className="p-1 font-medium text-center">PCS</td>
                    <td className="p-1 font-medium text-center">Shell</td>
                    <td className="p-1 font-medium text-center">PCS</td>
                    <td className="p-1 font-medium text-center">Shell</td>
                    <td className="p-1 font-medium text-center">PCS</td>
                    <td className="p-1 font-medium text-center">Shell</td>
                    <td className="p-1 font-medium text-center">PCS</td>
                    <td className="p-2"></td>
                    <td className="p-1 font-medium text-center">Shell</td>
                    <td className="p-1 font-medium text-center">PCS</td>
                    <td className="p-1 font-medium text-center">Shell</td>
                    <td className="p-1 font-medium text-center">PCS</td>
                  </tr>
                </thead>

                <tbody>
                  {tableRows.map((row, index) => {
                    const productName =
                      (typeof getProdName === "function" && getProdName(row)) ||
                      row.productName ||
                      row.product_detail?.product_name ||
                      `#${row.productId ?? index + 1}`;

                    const unitPrice =
                      typeof getUnitPrice === "function" ? getUnitPrice(row) : row.selling_price;

                    return (
                      <tr key={row.id ?? index} className="hover:bg-gray-50">
                        <td className="p-2">{productName}</td>

                        {/* Dispatched */}
                        <td className="p-2 text-center">{n(row.dispatched_shell)}</td>
                        <td className="p-2 text-center">{n(row.dispatched_pcs)}</td>

                        {/* Empty Prices (peso) */}
                        <td className="p-2 text-center">{peso(row.empty_price_shell)}</td>
                        <td className="p-2 text-center">{peso(row.empty_price_pc)}</td>

                        {/* Empty: Returned */}
                        <td className="p-2 text-center">{n(row.empty_return_shell)}</td>
                        <td className="p-2 text-center">{n(row.empty_return_pcs)}</td>

                        {/* Empty: Discrepancy */}
                        <td className="p-2 text-center">
                          <span
                            className={
                              n(row.discrepancy_empties_shell)
                                ? "bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded"
                                : ""
                            }
                          >
                            {n(row.discrepancy_empties_shell)}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          <span
                            className={
                              n(row.discrepancy_empties_pc)
                                ? "bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded"
                                : ""
                            }
                          >
                            {n(row.discrepancy_empties_pc)}
                          </span>
                        </td>

                        {/* With Contents */}
                        <td className="p-2 text-center">{peso(unitPrice)}</td>
                        <td className="p-2 text-center">{n(row.actual_return_shell)}</td>
                        <td className="p-2 text-center">{n(row.actual_return_pcs)}</td>
                        <td className="p-2 text-center">
                          <span
                            className={
                              n(row.discrepancy_full_shell)
                                ? "bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded"
                                : ""
                            }
                          >
                            {n(row.discrepancy_full_shell)}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          <span
                            className={
                              n(row.discrepancy_full_pcs)
                                ? "bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded"
                                : ""
                            }
                          >
                            {n(row.discrepancy_full_pcs)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr className="bg-slate-100 font-semibold text-[13px]">
                    <td className="p-2 text-left">TOTAL</td>

                    {/* Dispatched – blank */}
                    <td className="p-2"></td>
                    <td className="p-2"></td>

                    {/* Empty Prices – no total */}
                    <td className="p-2"></td>
                    <td className="p-2"></td>

                    {/* Empty: Returned totals */}
                    <td className="p-2 text-center">{sumEmptyRetShell}</td>
                    <td className="p-2 text-center">{sumEmptyRetPcs}</td>

                    {/* Empty: Discrepancy totals */}
                    <td className="p-2 text-center">{sumDiscEmptyShell}</td>
                    <td className="p-2 text-center">{sumDiscEmptyPcs}</td>

                    {/* With Contents: Selling Price – no total */}
                    <td className="p-2"></td>

                    {/* With Contents: Returned totals */}
                    <td className="p-2 text-center">{sumFullRetShell}</td>
                    <td className="p-2 text-center">{sumFullRetPcs}</td>

                    {/* With Contents: Discrepancy totals */}
                    <td className="p-2 text-center">{sumDiscFullShell}</td>
                    <td className="p-2 text-center">{sumDiscFullPcs}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : (
          /* your non-van-load table stays as-is */
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
                    <td className="p-2">₱{n(getUnitPrice(row)).toFixed(2)}</td>
                    <td className="p-2">{n(getDiscountPercent(row)).toFixed(2)}</td>
                    <td className="p-2">₱{n(getLineTotal(row)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Payment Breakdown */}
        <h3 className="font-semibold mt-4 mb-0">Payment Breakdown</h3>
        <div className="mt-6 text-sm">
          <div className="flex flex-col bg-transparent p-6 border-[1px] border-black">
            {isVanLoad ? (
              // ---------- VAN LOAD layout ----------
              <div className="space-y-8">
                {/* Expected Sale */}
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Expected Sale</h3>
                  <div className="tabular-nums">₱{fmt(expectedSale)}</div>
                </div>

                {/* Total Actual Retrieved */}
                <div>
                  <div className="font-semibold mb-2">Total Actual Retrieved:</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Actual Sale:</span>
                      <span className="tabular-nums">₱{fmt(vl_actual)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Returned With Content:</span>
                      <span className="tabular-nums">+ ₱{fmt(vl_retWc)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Discrepancies (non-empty):</span>
                      <span className="tabular-nums">+ ₱{fmt(vl_discNE)}</span>
                    </div>

                    <div className="border-t mt-2 pt-2 flex justify-between font-semibold">
                      <span>Total:</span>
                      <span className="tabular-nums">₱{fmt(vl_totalActualRetrieved)}</span>
                    </div>
                  </div>
                </div>

                {/* Overall Total */}
                <div>
                  <div className="font-semibold mb-2">Overall Total:</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Actual Sale:</span>
                      <span className="tabular-nums">₱{fmt(vl_actual)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Discrepancies (empty):</span>
                      <span className="tabular-nums">+ ₱{fmt(vl_discE)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Discrepancies (non-empty):</span>
                      <span className="tabular-nums">+ ₱{fmt(vl_discNE)}</span>
                    </div>

                    <div className="border-t mt-2 pt-2 flex justify-between font-semibold">
                      <span>Total:</span>
                      <span className="tabular-nums">₱{fmt(vl_overallTotal)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span>Expenses:</span>
                      <span className="tabular-nums">- ₱{fmt(expensesTotal)}</span>
                    </div>

                    <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                      <span>Grand Total:</span>
                      <span className="tabular-nums">₱{fmt(vl_grandTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // ---------- WAREHOUSE ----------
              <>
                <h3 className="font-semibold mb-2">Payment Breakdown</h3>
                <div className="space-y-1">
                  <div className="font-semibold mb-2 flex justify-between">
                    <span>Actual Sales:</span>
                    <span className="tabular-nums">₱{fmt(actualSalesValue)}</span>
                  </div>
                  <div className="border-t mt-2 pt-2 flex justify-between font-semibold">
                    <span>Discrepancy:</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Empties Price Total: </span>
                    <span className="tabular-nums"> ₱{fmt(emptiesPriceTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Empty Returns:</span>
                    <span className="tabular-nums">- ₱{fmt(emptyReturns)}</span>
                  </div>

                  <div className="border-t mt-2 pt-2 flex justify-between font-semibold">
                    <span>Total:</span>
                    <span className="tabular-nums">₱{fmt(emptyDiscrepancies)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Actual Sales</span>
                    <span className="tabular-nums">+ ₱{fmt(actualSalesValue)}</span>
                  </div>

                  <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                    <span>Total Amount Due:</span>
                    <span className="tabular-nums">₱{fmt(totalAmountFinal)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

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

                miscItems,

                // credit extras
                paymentTermsDays: days,
                dueDate: paymentDueDate.toISOString(),
                creditNotes,

                // carry these for invoice parity
                expectedSale: n(expectedSale),
                totalReturnedWithContent: n(totalReturnedWithContent),
                totalDiscrepancyNonEmpty: n(totalDiscrepancyNonEmpty),

                totalActualRetrievedVL: n(totalActualRetrievedVL),
                overallTotalVL: n(overallTotalVL),
                grandTotalVL: n(grandTotalVL),

                // final due used in the modal
                amountDue: amountDueFinal,
              };

              const isCredit = data.paymentMethod === "credit";
              const paymentOk =
                data.paymentMethod === "cash" ? n(cashReceived) >= amountDueFinal : true;

              try {
                setSubmitting(true);

                // 1) If credit, create the ledger first
                let createdLedger = null;
                if (isCredit) {
                  try {
                    createdLedger = await createCreditLedgerFromModalPayload(data);
                    data.creditLedger = createdLedger;
                  } catch (err) {
                    const resp = err?.response;
                    const details = resp?.data
                      ? JSON.stringify(resp.data, null, 2)
                      : err?.message || String(err);
                    console.error("Create credit failed:", err);
                    alert("Credit save failed:\n" + details);
                    setSubmitting(false);
                    return;
                  }
                }

                // 2) Existing save logic
                if (isVanLoad && paymentOk && typeof onPaymentSuccess === "function") {
                  await onPaymentSuccess(data);
                }
                if (typeof onConfirm === "function") {
                  await onConfirm(data);
                }
                if (typeof onSave === "function") {
                  await onSave(data);
                }

                // 3) Show invoice
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
          transactionTypes={transactionTypes}
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
