import React from "react";
import { useNavigate } from "react-router-dom";

const InvoiceModal = ({ onClose, invoiceData = {} }) => {
  const navigate = useNavigate();

  // ---------- unpack from PaymentModal ----------
  const {
    paymentMethod,
    cashReceived,
    change,
    amountDue,
    totalAmount,

    // header / context
    mspNo,
    customerName,
    handledBy,
    transactionDate,
    transactionTypeName,

    // breakdown numbers
    rows = [],
    actualSales,
    emptiesPriceTotal,
    emptyReturns,
    emptyDiscrepancies,

    // van load only
    expensesTotal = 0,
    remarks = "",
  } = invoiceData;

  const isVanLoad = (transactionTypeName || "").toLowerCase() === "van load";
  const isWarehouse = (transactionTypeName || "").toLowerCase() === "warehouse";

  // ---------- helpers ----------
  const n = (v) => Number(v || 0);
  const fmt = (v) => n(v).toFixed(2);

  const pickNum = (...vals) => {
    for (const v of vals) {
      if (v !== "" && v !== null && v !== undefined) {
        const num = Number(v);
        if (!Number.isNaN(num)) return num;
      }
    }
    return 0;
  };

  const getProdName = (r) =>
    r.productName || r.product_name || r.product_detail?.product_name || "—";

  const getDispatchedShell = (r) => pickNum(r.dispatchedShell, r.dispatched_shell);
  const getDispatchedPcs   = (r) => pickNum(r.dispatchedPcs, r.dispatched_pcs);
  const getSoldShell       = (r) => pickNum(r.soldShell, r.sold_shell);
  const getSoldPcs         = (r) => pickNum(r.soldPcs, r.sold_pcs, r.qty, r.quantity);

  const getUnitPrice       = (r) => pickNum(r.unitPrice, r.selling_price, r.price);
  const getDiscountPercent = (r) => pickNum(r.discount_percent, r.discount);
  const getDiscountAmount  = (r) => pickNum(r.discount_amount, r.discount_amt);

  const getEmptyShellPrice = (r) =>
    pickNum(r.shellPrice, r.empty_price_shell, r.emptyPriceShell);
  const getEmptyBottlePrice = (r) =>
    pickNum(r.bottlePrice, r.empty_price_pc, r.emptyPricePc);

  const getReturnedShells = (r) =>
    pickNum(r.expectedReturnShellEmpty, r.empty_return_shell, r.returnedEmptyShell);
  const getReturnedPcs = (r) =>
    pickNum(r.expectedReturnPcsEmpty, r.empty_return_pcs, r.returnedEmptyPcs);

  const getDirectActual = (r) =>
    pickNum(r.actualSale, r.actual_sale, r.total, r.line_total, r.lineTotal);

  const getRowActual = (r) => {
    const direct = getDirectActual(r);
    if (direct) return direct;

    // fallback compute
    const pcs   = getSoldPcs(r);
    const shell = getSoldShell(r);
    const price = getUnitPrice(r);

    if (isWarehouse) {
      const discPct = getDiscountPercent(r);
      const discAmtFromPct = (price * pcs * discPct) / 100;
      const discAmt = getDiscountAmount(r) || discAmtFromPct;
      return Number((pcs * price - discAmt).toFixed(2));
    }

    // Van Load: pcs*unit + shells*emptyShell, then discount %
    const emptyShell = getEmptyShellPrice(r);
    const gross = pcs * price + shell * emptyShell;
    const discPct = getDiscountPercent(r);
    return Number((gross * (1 - discPct / 100)).toFixed(2));
  };

  const rowEmptiesValue = (r) => {
    const shell = getSoldShell(r);
    const pcs = getSoldPcs(r);
    return Number((shell * getEmptyShellPrice(r) + pcs * getEmptyBottlePrice(r)).toFixed(2));
  };

  const rowReturnsValue = (r) => {
    const shells = getReturnedShells(r);
    const pcs = getReturnedPcs(r);
    return Number((shells * getEmptyShellPrice(r) + pcs * getEmptyBottlePrice(r)).toFixed(2));
  };

  const tableRows = (rows || []).filter(
    (r) =>
      getProdName(r) !== "—" ||
      getSoldPcs(r) > 0 ||
      getSoldShell(r) > 0 ||
      getUnitPrice(r) > 0
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

  const handleClose = () => {
    onClose?.();
    navigate("/merchandising-sale", { replace: true, state: { reset: true } });
  };

  // ----------------------------------------------------------------
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-5xl p-6 rounded-lg overflow-y-auto max-h-[90vh] shadow-lg relative">

        {/* Top Buttons */}
        <div className="flex justify-between items-center mb-4">
          <button className="bg-gray-100 text-black px-3 py-1 rounded hover:bg-gray-200">
            🏠 New Sale
          </button>
          <div className="space-x-2">
            <button className="bg-white border border-gray-300 px-3 py-1 rounded hover:bg-gray-100">
              ⬇️ Download PDF
            </button>
            <button className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">
              🖨️ Print Invoice
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="bg-blue-500 text-white p-4 rounded-md flex justify-between items-center relative">
          <div>
            <h2 className="text-lg font-bold">INVOICE</h2>
            <p className="text-sm">Invoice No: {mspNo || "—"}</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded absolute top-4 right-4 ${
            paymentMethod === "credit" ? "bg-yellow-500" : "bg-green-500"
          }`}>
            {paymentMethod === "credit" ? "CREDIT" : "PAID"}
          </span>
        </div>

        {/* From / To / Meta */}
        <div className="mt-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold">From:</h4>
              <p>
                Your Company Name<br />
                123 Business Street<br />
                City, State 12345<br />
                Phone: (555) 123-4567
              </p>
            </div>
            <div>
              <h4 className="font-semibold">To:</h4>
              <p>{customerName || "Walk-in Customer"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
            <p><strong>Invoice No:</strong> {mspNo || "—"}</p>
            <p><strong>Date:</strong> {formatLocalToManila(transactionDate) || "—"}</p>
            <p><strong>Payment Method:</strong> {paymentMethod ? paymentMethod.toUpperCase() : "—"}</p>
            <p><strong>Handled By:</strong> {handledBy || "—"}</p>
          </div>
          <div className="mt-1"><strong>Transaction Type:</strong> {transactionTypeName || "—"}</div>
        </div>

        {/* SOLD PRODUCTS */}
        <div className="mt-6">
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
                  <td className="border px-2 py-1">{`${getDispatchedShell(row)} shells (${getDispatchedPcs(row)} pcs)`}</td>
                  <td className="border px-2 py-1">{`${getSoldShell(row)} shells (${getSoldPcs(row)} pcs)`}</td>
                  <td className="border px-2 py-1">₱{fmt(getUnitPrice(row))}</td>
                  <td className="border px-2 py-1">{fmt(getDiscountPercent(row))}</td>
                  <td className="border px-2 py-1">₱{fmt(getRowActual(row))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-right font-semibold mt-1">
            SUBTOTAL: ₱{fmt(actualSales)}
          </p>
        </div>

        {/* EMPTY PRICE (value from sold empties) */}
        <div className="mt-6">
          <h4 className="font-bold mb-2 text-gray-700">EMPTY PRICE</h4>
          <table className="w-full text-sm border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Product</th>
                <th className="p-2 text-left">Shell Price</th>
                <th className="p-2 text-left">Bottle Price</th>
                <th className="p-2 text-left">Total Shells</th>
                <th className="p-2 text-left">Total Pieces</th>
                <th className="p-2 text-left">Amount</th>
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
          <p className="text-right font-semibold mt-1">
            SUBTOTAL: ₱{fmt(emptiesPriceTotal)}
          </p>
        </div>

        {/* RETURNS (value of empty returns) */}
        <div className="mt-6">
          <h4 className="font-bold mb-2 text-gray-700">RETURNS</h4>
          <table className="w-full text-sm border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Product</th>
                <th className="p-2 text-left">Shell Price</th>
                <th className="p-2 text-left">Bottle Price</th>
                <th className="p-2 text-left">Returned Shells</th>
                <th className="p-2 text-left">Returned Pieces</th>
                <th className="p-2 text-left">Amount</th>
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
          <p className="text-right font-semibold mt-1">
            SUBTOTAL: ₱-{fmt(emptyReturns)}
          </p>
        </div>

        {/* Totals / Breakdown */}
        <div className="mt-6 text-sm">
          <div className="border p-4 rounded space-y-1">
            <div><strong>Actual Sales:</strong> ₱{fmt(actualSales)}</div>
            <div>- Empties Price Total: ₱{fmt(emptiesPriceTotal)}</div>
            <div>- Empty Returns: ₱-{fmt(emptyReturns)}</div>
            <div>- Empty Discrepancies: ₱{fmt(emptyDiscrepancies)}</div>
            {isVanLoad && <div>- Expenses: ₱{fmt(expensesTotal)}</div>}
            <div className="text-lg font-bold text-green-600">
              Total Amount Due: ₱{fmt(totalAmount)}
            </div>
            {isVanLoad && remarks && (
              <div className="pt-2">
                <strong>Remarks:</strong> {remarks}
              </div>
            )}
            <div className="pt-2 grid grid-cols-2 gap-2">
              <div><strong>Cash Received:</strong> ₱{fmt(cashReceived)}</div>
              <div><strong>Change:</strong> ₱{fmt(change)}</div>
            </div>
          </div>
        </div>

        {/* Close */}
        <div className="text-right mt-6">
          <button
            onClick={handleClose}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
