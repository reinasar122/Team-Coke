// src/components/PaymentModal.jsx
import React, { useState, useMemo, useEffect } from "react";
import InvoiceModal from "./InvoiceModal";
import axios from "axios";
import api from "../api"; // ensure api is imported so env vars are loaded import ".";


// ---- Helper to create a Credit Ledger on the backend (POST /api/credits/) ----
async function createCreditLedgerFromModalPayload(payload) {
  // Accept both explicit "credit" and mixed "cash+credit"
  if (payload.paymentMethod !== "credit" && payload.paymentMethod !== "cash+credit") {
    return null;
  }

  console.log("🔍 Full credit payload:", payload);
  console.log("🔍 Available keys:", Object.keys(payload));


  // ✅ Try multiple warehouse ID extraction methods
  const warehouseId =
    payload.warehouseId ||
    payload.warehouse_id ||
    payload.warehouse?.id ||
    payload.warehouse?.warehouse_id ||
    (typeof payload.warehouse === 'number' ? payload.warehouse : null) ||
    null;


  console.log("🏪 Extracted warehouse ID:", warehouseId);
  console.log("🏪 Warehouse ID type:", typeof warehouseId);


  if (!warehouseId) {
    console.error("❌ No warehouse ID found:", {
      warehouseId: payload.warehouseId,
      warehouse_id: payload.warehouse_id,
      warehouse: payload.warehouse,
      warehouseType: typeof payload.warehouse,
      allPayloadKeys: Object.keys(payload)
    });
    throw new Error("Warehouse ID is required for credit transactions");
  }


  const body = {
    msp_no: payload.mspNo,
    customerName: payload.customerName,
    handledBy: payload.handledBy,
    transactionTypeName: payload.transactionTypeName,
    remarks: payload.creditNotes || "",
    payment_terms_days: payload.paymentTermsDays,
    due_date: payload.dueDate,
    totalAmount: payload.totalAmount,      // always full ₱420
    amountPaid: payload.cashReceived || 0, // upfront cash ₱200
    rows: payload.rows || [],
    transactionDate: payload.transactionDate || new Date().toISOString(),
    warehouse: Number(warehouseId), // ✅ Ensure it's a number
  };


  try {
    const res = await api.post("/credits/", body);
    console.log("✅ Credit created successfully:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ Credit creation failed:", err.response?.data || err.message);
    throw err;
  }
}


const PaymentModal = ({
  open,
  onClose,
  onConfirm,
  onSave,
  onPaymentSuccess,
  transactionId,


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
  warehouse, // ✅ ADD WAREHOUSE PROP
}) => {
  // ✅ DEBUG: Log warehouse prop when component renders
  console.log("🏪 PaymentModal received warehouse prop:", warehouse);
  console.log("🏪 Warehouse type:", typeof warehouse);
  console.log("🏪 Warehouse keys:", warehouse ? Object.keys(warehouse) : "null/undefined");


  // ------------ hooks ------------
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("30 Days");
  const [creditNotes, setCreditNotes] = useState("");
  const [invoiceData, setInvoiceData] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [customerInput, setCustomerInput] = useState(customerName || "Walk-in");


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


  // ✅ Custom alert function
  const showAlert = (message) => {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    alertDiv.innerHTML = `
      <div class="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
        <p class="text-gray-700 mb-4">${message}</p>
        <div class="flex justify-end">
          <button class="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded" onclick="this.closest('.fixed').remove()">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(alertDiv);
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
    row.productName || row.product_name || row.product_detail?.product_name || "--";


  //jea
  const getDispatchedShell = (r) => pickNum(r.dispatchedShell, r.dispatched_shell);
  const getDispatchedPcs   = (r) => pickNum(r.dispatchedPcs, r.dispatched_pcs);
  const getEmptyBottlePrice = (r) => pickNum(r.bottlePrice, r.empty_price_pc, r.emptyPricePc);
  const getReturnedShells = (r) =>
    pickNum(r.expectedReturnShellEmpty, r.empty_return_shell, r.returnedEmptyShell);
  const getReturnedPcs = (r) =>
    pickNum(r.expectedReturnPcsEmpty, r.empty_return_pcs, r.returnedEmptyPcs);
  const getDirectActual = (r) =>
    pickNum(r.actualSale, r.actual_sale, r.total, r.line_total, r.lineTotal);
  const getRowActual = (r) => {
    const direct = getDirectActual(r);
    if (direct) return direct;


    const pcs = getSoldPcs(r);
    const shell = getSoldShell(r);
    const price = getUnitPrice(r);


    if (isWarehouse) {
      const discPct = getDiscountPercent(r);
      const discAmtFromPct = (price * pcs * discPct) / 100;
      const discAmt = getDiscountAmount(r) || discAmtFromPct;
      return Number((pcs * price - discAmt).toFixed(2));
    }


    const emptyShell = getEmptyShellPrice(r);
    const gross = pcs * price + shell * emptyShell;
    const discPct = getDiscountPercent(r);
    return Number((gross * (1 - discPct / 100)).toFixed(2));
  };
  const rowEmptiesValue = (r) => {
  const shell = getSoldShell(r);
  const pcs = getSoldPcs(r);
    return shell * getEmptyShellPrice(r) + pcs * getEmptyBottlePrice(r);
  };


  const rowReturnsValue = (r) => {
    const shells = getReturnedShells(r);
    const pcs = getReturnedPcs(r);
    return shells * getEmptyShellPrice(r) + pcs * getEmptyBottlePrice(r);
  }; //jea


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
          getProdName(r) !== "--" ||
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


  // Clear cash input every time the modal opens or a new MSP is loaded
  useEffect(() => {
    if (open) {
      setCashReceived("");      // clears the Cash Amount Received box
    }
  }, [open, mspNo]);


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


  // Prefer parent values only if they're explicitly positive
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


  const expensesList = useMemo(() => miscItems || [], [miscItems]);


  const expensesTotalComputed = useMemo(
    () => expensesList.reduce((s, i) => s + n(i?.amount), 0),
    [expensesList]
  );


  // Returnables Summary counts
  const sumEmptyRetShellValue = useMemo(
    () =>
      tableRows.reduce(
        (a, r) => a + n(r?.empty_return_shell) * n(r?.empty_price_shell),
        0
      ),
    [tableRows]
  );


  const sumEmptyRetPcsValue = useMemo(
    () =>
      tableRows.reduce(
        (a, r) => a + n(r?.empty_return_pcs) * n(r?.empty_price_pc),
        0
      ),
    [tableRows]
  );


  const sumDiscEmptyShell = useMemo(
    () =>
      tableRows.reduce(
        (a, r) => a + n(r?.discrepancy_empties_shell) * n(r?.empty_price_shell),
        0
      ),
    [tableRows]
  );
 
  const sumDiscEmptyPcs = useMemo(
    () =>
      tableRows.reduce(
        (a, r) => a + n(r?.discrepancy_empties_pc) * n(r?.empty_price_pc),
        0
      ),
    [tableRows]
  );
 
  // With contents (PCS) -- peso value (unit price × actual_return_pcs)
  const sumFullRetPcs = useMemo(
    () =>
      tableRows.reduce(
        (a, r) =>
          a +
          n(r?.actual_return_pcs) *
            n(r?.unitPrice ?? r?.selling_price ?? r?.price),
        0
      ),
    [tableRows]
  );


  // With contents discrepancy (PCS) -- peso value (unit price × discrepancy_full_pcs)
  const sumDiscFullPcs = useMemo(
    () =>
      tableRows.reduce(
        (a, r) =>
          a +
          n(r?.discrepancy_full_pcs) *
            n(r?.unitPrice ?? r?.selling_price ?? r?.price),
        0
      ),
    [tableRows]
  );


  // ------------- early return AFTER hooks -------------
  if (!open) return null;


  const subtotalFromRows = tableRows.reduce((sum, r) => sum + getRowActual(r), 0);
  // Prefer backend actualSales if > 0, else use calculated rows
  const subtotal = n(actualSales) > 0 ? n(actualSales) : subtotalFromRows;


  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-30 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg w-full max-w-4xl shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="border-b pb-2 mb-4">
          <h2 className="text-xl font-bold">Payment Confirmation</h2>
        </div>


        {/* Header Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>MSP No.</strong>: {mspNo || "--"}
          </div>
          <div>
            <strong>Date</strong>: {formatLocalToManila(transactionDate) || "--"}
          </div>
          <div>
            <strong>Customer</strong>: {(customerName ?? "").trim() || "Walk-in"}
          </div>
          <div>
            <strong>Handled By</strong>: {handledBy || "--"}
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
                    {/* Dispatched & Sold -- blank for clean layout */}
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    {/* Selling Price, Discount -- no totals */}
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    <td className="p-2 text-center">{peso(sumExpectedSale)}</td>
                    <td className="p-2 text-center">{peso(sumActualSale)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>


            {/* ===== 2) RETURNABLES SUMMARY (PCS-only) ===== */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-2">Returnables Summary</h3>


                <table className="w-full mt-4 border">
                  <thead className="bg-gray-200 text-sm text-gray-800">
                    <tr className="text-xs font-semibold">
                      <th className="p-2 text-left">Product</th>


                      {/* Dispatched */}
                      <th className="p-2 text-center">Dispatched (PCS)</th>


                      {/* Empty Prices */}
                      <th className="p-2 text-center">Empty Price (PC)</th>


                      {/* Empty: Returned / Discrepancy (PCS) */}
                      <th className="p-2 text-center">Empty: Returned (PCS)</th>
                      <th className="p-2 text-center">Empty: Discrepancy (PCS)</th>


                      {/* With Contents */}
                      <th className="p-2 text-center">With Contents: Unit Price</th>
                      <th className="p-2 text-center">With Contents: Returned (PCS)</th>
                      <th className="p-2 text-center">With Contents: Discrepancy (PCS)</th>
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
                        (typeof getUnitPrice === "function" && getUnitPrice(row)) ||
                        row.selling_price;


                      return (
                        <tr key={row.id ?? index} className="hover:bg-gray-50">
                          <td className="p-2">{productName}</td>


                          {/* Dispatched (PCS only) */}
                          <td className="p-2 text-center">{n(row.dispatched_pcs)}</td>


                          {/* Empty Price (PC) */}
                          <td className="p-2 text-center">{peso(row.empty_price_pc)}</td>


                          {/* Empty: Returned (PCS) */}
                          <td className="p-2 text-center">{n(row.empty_return_pcs)}</td>


                          {/* Empty: Discrepancy (PCS) */}
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


                          {/* With Contents: Returned (PCS) */}
                          <td className="p-2 text-center">{n(row.actual_return_pcs)}</td>


                          {/* With Contents: Discrepancy (PCS) */}
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


                      {/* Dispatched (PCS) -- no peso */}
                      <td className="p-2"></td>


                      {/* Empty Price (PC) -- no total */}
                      <td className="p-2"></td>


                      {/* Empty: Returned (PCS) -- show peso total */}
                      <td className="p-2 text-center">{peso(sumEmptyRetPcsValue)}</td>


                      {/* Empty: Discrepancy (PCS) -- show peso total */}
                      <td className="p-2 text-center">{peso(sumDiscEmptyPcs)}</td>


                      {/* With Contents: Unit Price -- no total */}
                      <td className="p-2"></td>


                      {/* With Contents: Returned (PCS) -- peso total */}
                      <td className="p-2 text-center">{peso(sumFullRetPcs)}</td>


                      {/* With Contents: Discrepancy (PCS) -- peso total */}
                      <td className="p-2 text-center">{peso(sumDiscFullPcs)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>


            <div className="mt-6">
              <h3 className="font-semibold mb-2">Expenses Summary</h3>


              <table className="w-full mt-4 border">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-right">Amount (₱)</th>
                  </tr>
                </thead>
                <tbody>
                  {expensesList.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="p-2 text-center text-gray-500">
                        No expenses added
                      </td>
                    </tr>
                  ) : (
                    expensesList.map((exp, idx) => (
                      <tr key={idx}>
                        <td className="p-2 text-left">{exp?.description || "--"}</td>
                        <td className="p-2 text-right">₱{n(exp?.amount).toFixed(2)}</td>
                      </tr>
                    ))
                  )}


                  <tr className="font-semibold bg-slate-100">
                    <td className="p-2 text-left">Total</td>
                    <td className="p-2 text-right">₱{expensesTotalComputed.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : (
          /* your non-van-load table stays as-is */
          <>
            {/* SOLD PRODUCTS (same as InvoiceModal)   -jea  */}
            <div className="mt-4">
              <h4 className="font-bold mb-2 text-gray-700">SOLD PRODUCTS</h4>
              <table className="w-full text-sm border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Product</th>
                    <th className="p-2 text-left">Dispatched</th>
                    <th className="p-2 text-left">Sold</th>
                    <th className="p-2 text-left">Unit Price</th>
                    <th className="p-2 text-left">Discount (%)</th>
                    <th className="p-2 text-left">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => (
                    <tr key={i}>
                      <td className="border px-2 py-1">{getProdName(row)}</td>
                      <td className="border px-2 py-1">
                        {`${getDispatchedShell(row)} shells (${getDispatchedPcs(row)} pcs)`}
                      </td>
                      <td className="border px-2 py-1">
                        {`${getSoldShell(row)} shells (${getSoldPcs(row)} pcs)`}
                      </td>
                      <td className="border px-2 py-1">₱{fmt(getUnitPrice(row))}</td>
                      <td className="border px-2 py-1">{fmt(getDiscountPercent(row))}</td>
                      <td className="border px-2 py-1">₱{fmt(getRowActual(row))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-right font-semibold mt-1">
                SUBTOTAL: ₱{fmt(subtotal)}
              </p>
            </div>


            {/* EMPTY PRICE */}
            <div className="mt-6">
              <h4 className="font-bold mb-2 text-gray-700">EMPTY PRICE</h4>
              <table className="w-full text-sm border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2">Product</th>
                    <th className="p-2">Shell Price</th>
                    <th className="p-2">Bottle Price</th>
                    <th className="p-2">Total Shells</th>
                    <th className="p-2">Total Pieces</th>
                    <th className="p-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => (
                    <tr key={i}>
                      <td className="border px-2 py-1">{getProdName(row)}</td>
                      <td className="border px-2 py-1">₱{fmt(getEmptyShellPrice(row))}</td>
                      <td className="border px-2 py-1">₱{fmt(getEmptyBottlePrice(row))}</td>
                      <td className="border px-2 py-1">{getSoldShell(row)}</td>
                      <td className="border px-2 py-1">{getSoldPcs(row)}</td>
                      <td className="border px-2 py-1">₱{fmt(rowEmptiesValue(row))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-right font-semibold mt-1">SUBTOTAL: ₱{fmt(emptiesPriceTotal)}</p>
            </div>


            {/* RETURNS */}
            <div className="mt-6">
              <h4 className="font-bold mb-2 text-gray-700">RETURNS</h4>
              <table className="w-full text-sm border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2">Product</th>
                    <th className="p-2">Shell Price</th>
                    <th className="p-2">Bottle Price</th>
                    <th className="p-2">Returned Shells</th>
                    <th className="p-2">Returned Pieces</th>
                    <th className="p-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => (
                    <tr key={i}>
                      <td className="border px-2 py-1">{getProdName(row)}</td>
                      <td className="border px-2 py-1">₱{fmt(getEmptyShellPrice(row))}</td>
                      <td className="border px-2 py-1">₱{fmt(getEmptyBottlePrice(row))}</td>
                      <td className="border px-2 py-1">{getReturnedShells(row)}</td>
                      <td className="border px-2 py-1">{getReturnedPcs(row)}</td>
                      <td className="border px-2 py-1">₱{fmt(rowReturnsValue(row))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-right font-semibold mt-1">SUBTOTAL: ₱-{fmt(emptyReturns)}</p>
            </div>
          </>
        )}


        {/* Payment Breakdown */}
       
        <div className="mt-6 text-sm">
          <h3 className="font-semibold mb-2">Payment Breakdown</h3>
          <div className="flex flex-col bg-transparent p-6 border-[2px] border-slate-200">
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
                    <span className="tabular-nums">
                      ₱{fmt(n(emptiesPriceTotal) - n(emptyReturns))}
                    </span>
                  </div>


                  <div className="flex justify-between">
                    <span>Actual Sales</span>
                    <span className="tabular-nums">+ ₱{fmt(actualSalesValue)}</span>
                  </div>


                  {/* Karen changes */}
                    <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                      <span>Total Amount Due:</span>

                      <span className="tabular-nums text-3xl font-extrabold text-black">
                        ₱{fmt(totalAmountFinal)}
                      </span>
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
            {["cash"].map((method) => ( // Removed "bank" to exclude "E-wallet"
              <button
                key={method}
                className={`px-4 py-2 rounded border ${
                  paymentMethod === method ? "bg-blue-500 text-white" : "bg-gray-100"
                }`}
                onClick={() => setPaymentMethod(method)}
              >
                {method === "cash" ? "Cash" : "E-wallet"} {/* Only "Cash" will be displayed */}
              </button>
            ))}
          </div>


          {paymentMethod === "cash" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1">Cash Amount Received</label>
                <input
                  type="number"
                  className="w-full border-[2px] border-slate-200 rounded px-2 py-1"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                />
              </div>
              <div>
                <label className="block mb-1">Amount Due</label>
                <input
                  className="w-full border-[2px] border-slate-200 rounded px-2 py-1"
                  value={`₱${fmt(amountDueFinal)}`}
                  readOnly
                />
              </div>

              {showChange && n(cashReceived) >= amountDueFinal && (
                <div>
                  <label className="block mb-1">Change</label>
                  <input
                    className="w-full border-[2px] border-slate-200 rounded px-2 py-1"
                    value={`₱${fmt(change)}`}
                    readOnly
                  />
                </div>
              )}

              {/* If cash < due → show Credit section */}
                {n(cashReceived || 0) < amountDueFinal && (
                  <div className="col-span-2 mt-6 space-y-4">
                    <div className="bg-blue-100 border border-blue-300 p-4 rounded">
                      <div className="font-semibold text-blue-700">Credit Amount:</div>
                      <div className="flex justify-between items-center mt-1 text-sm">
                        <div className="flex flex-col gap-2">
                          {isVanLoad ? (
                            // 👇 Allow typing customer name ONLY for Van Load + Credit
                            <div>
                              <label className="font-semibold mr-2">Customer:</label>
                              <input
                                type="text"
                                className="border border-blue-300 rounded px-2 py-1 w-48"
                                placeholder="Enter customer name"
                                value={customerInput}
                                onChange={(e) => setCustomerInput(e.target.value)}
                              />
                            </div>
                          ) : (
                            // 👇 For Warehouse, keep it fixed as Walk-in
                            <div>
                              <strong>Customer:</strong> {customerName || "Walk-in"}
                            </div>
                          )}
                          <div><strong>Due:</strong> {formattedDueDate}</div>
                        </div>
                        <div className="text-2xl font-bold text-blue-800">
                          ₱{fmt(amountDueFinal - n(cashReceived || 0))}
                        </div>
                      </div>
                    </div>


                    {/* 📅 Credit Terms & Notes */}
                    <div className="p-4 border-[2px] border-slate-200 rounded space-y-4">
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
                          placeholder="Add any special arrangements or notes..."
                          value={creditNotes}
                          onChange={(e) => setCreditNotes(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

            </div>
          )}

        </div>


        {/* Footer Buttons */}
        <div className="mt-6 flex justify-between">
          <button className="btn btn-back" onClick={onClose} disabled={submitting}>
            Back to Sale
          </button>
          <button
            className="btn btn-primary"
            disabled={submitting}
           onClick={async () => {
              console.log("🏪 Button clicked - warehouse:", warehouse);

              let warehouseId = null;
              let warehouseName = null;

              if (warehouse) {
                warehouseId = warehouse.id || warehouse.warehouse_id;
                warehouseName = warehouse.name || warehouse.warehouse_name || warehouse.warehouse;
              }

              // Fallback: try to get from localStorage
              if (!warehouseId) {
                const user = JSON.parse(localStorage.getItem("user") || "{}");
                const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");

                if (selectedWarehouse?.id) {
                  warehouseId = selectedWarehouse.id;
                  warehouseName = selectedWarehouse.name;
                } else if (user.warehouse_id) {
                  warehouseId = user.warehouse_id;
                  warehouseName = user.warehouse;
                }
              }

              console.log("🏪 Final warehouse ID:", warehouseId);
              console.log("🏪 Final warehouse name:", warehouseName);

              if (!warehouseId && paymentMethod === "credit") {
                showAlert("Warehouse is required for credit transactions. Please refresh the page and try again.");
                return;
              }

              // ✅ DEFINE DATA FIRST
              const data = {
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
                discrepancy_empty: isWarehouse ? n(emptyDiscrepancies || 0) : undefined,
                expensesTotal: n(expensesTotal),
                totalAmount: totalAmountFinal,

                // rows + headers
                rows,
                mspNo,
                customerName: isVanLoad ? (customerInput || "Walk-in") : (customerName || "Walk-in"),
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

                // ✅ Only warehouse (integer ID)
                warehouse: warehouseId,

                merchandisingId: mspNo ? Number(String(mspNo).replace(/\D/g, "")) : null,
              };

              console.log("💳 Complete payment data:", data);

              // ✅ NOW SAFE TO USE data
              if (!data.payments || data.payments.length === 0) {
                if (n(cashReceived) >= amountDueFinal) {
                  data.payments = [{ amount: n(cashReceived), method: "cash" }];
                } else if (n(cashReceived) > 0 && n(cashReceived) < amountDueFinal) {
                  data.payments = [
                    { amount: n(cashReceived), method: "cash" },
                    { amount: amountDueFinal - n(cashReceived), method: "credit" },
                  ];
                } else if (n(cashReceived) === 0) {
                  data.payments = [{ amount: amountDueFinal, method: "credit" }];
                }
              }

              // ✅ Determine payment types
              // ✅ Corrected payment type detection
                const received = n(cashReceived);
                const due = n(amountDueFinal);

                let paymentType = "cash";
                let creditAmount = 0;

                if (received === 0 && due > 0) {
                  paymentType = "credit"; // full credit
                  creditAmount = due;
                } else if (received > 0 && received < due) {
                  paymentType = "cash+credit"; // partial
                  creditAmount = due - received;
                } else {
                  // received >= due → full cash
                  paymentType = "cash";
                  creditAmount = 0;
                }

                data.paymentMethod = paymentType;
                data.creditAmount = creditAmount;

                const isFullCash = paymentType === "cash";
                const isPartialCash = paymentType === "cash+credit";
                const isFullCredit = paymentType === "credit";
                const isCredit = isPartialCash || isFullCredit;



              const paymentOk = isFullCash || isCredit;


              try {
                setSubmitting(true);


                // 1) If credit, create the ledger first
                let createdLedger = null;
                  if (isCredit) {

                    // 🔹 ADD THIS BLOCK
                    // Always map Van Load rows
                      if (isVanLoad) {
                        data.rows_json = tableRows.map((r) => ({
                          productName: getProdName(r),
                          dispatchedShell: getDispatchedShell(r),
                          dispatchedPcs: getDispatchedPcs(r),
                          soldShell: getSoldShell(r),
                          soldPcs: getSoldPcs(r),
                          unitPrice: getUnitPrice(r),
                          discountPercent: getDiscountPercent(r),
                          emptyShellPrice: getEmptyShellPrice(r),
                          bottlePrice: getEmptyBottlePrice(r),
                          returnedShells: getReturnedShells(r),
                          returnedPcs: getReturnedPcs(r),
                          actualSale: getRowActual(r),
                        }));
                      }


                    try {
                      createdLedger = await createCreditLedgerFromModalPayload(data);
                      data.creditLedger = createdLedger;
                    } catch (err) {
                      const resp = err?.response;
                      const details = resp?.data
                        ? JSON.stringify(resp.data, null, 2)
                        : err?.message || String(err);
                      console.error("Create credit failed:", err);

                      const alertDiv = document.createElement('div');
                      alertDiv.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                      alertDiv.innerHTML = `
                        <div class="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
                          <h3 class="text-lg font-semibold text-red-600 mb-3">Credit Save Failed</h3>
                          <div class="text-gray-700 mb-4 text-sm max-h-48 overflow-y-auto">
                            <pre class="whitespace-pre-wrap">${details}</pre>
                          </div>
                          <div class="flex justify-end">
                            <button class="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded" onclick="this.closest('.fixed').remove()">OK</button>
                          </div>
                        </div>
                      `;
                      document.body.appendChild(alertDiv);

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
                  // ✅ Ensure Van Load always saves payment method properly
                  if (isVanLoad) {
                    if (isPartialCash) {
                      // Partial cash and credit mix
                      data.payments = [
                        { amount: n(cashReceived), method: "cash" },
                        { amount: amountDueFinal - n(cashReceived), method: "credit" },
                      ];
                    } else if (isCredit) {
                      // Pure credit (no cash)
                      data.payments = [
                        { amount: n(cashReceived || 0), method: "credit" },
                      ];
                    } else if (isFullCash) {
                      // ✅ Full cash payment
                      data.payments = [
                        { amount: n(cashReceived || amountDueFinal), method: "cash" },
                      ];
                    }
                  }


                  const merchandising = await onSave(data);
                  if (merchandising?.id) {
                    data.id = merchandising.id;
                  }
                }



                // 3) Show invoice
                setInvoiceData(data);
                setShowInvoiceModal(true);
              } catch (e) {
                console.error(e);
               
                // ✅ Use custom alert instead of browser alert
                showAlert("Payment save failed. Please try again.");
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
              invoiceData={{
                 ...invoiceData,
                  id: transactionId || invoiceData?.id || null }}
        />
      )}
    </div>
  );
};


export default PaymentModal;

