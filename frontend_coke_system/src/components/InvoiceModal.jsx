import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { downloadInvoicePDF } from "./PDFInvoice"; // ⬅️ new import
import { printReceipt } from "./receiptPrint"; // Make sure the file name is exactly 'receiptPrint.jsx'
import "react-toastify/dist/ReactToastify.css";
import api from "../api"; // ensure api is imported so env vars are loaded import ".";

// Define showCustomAlert (for demo purposes, using alert as fallback)
const showCustomAlert = (msg) => alert(msg);

const InvoiceModal = ({
  onClose,
  invoiceData = {},
  hidePaymentBreakdown = false,
  isViewOnly = false,
}) => {
  const navigate = useNavigate();
  const saleId = invoiceData?.id || null;

  // Get warehouse info from localStorage as fallback if not in props
  const getCurrentWarehouse = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");

    if (user.role?.toLowerCase() === "admin") {
      return selectedWarehouse || {
        id: user.warehouse_id,
        name: user.warehouse,
      };
    } else {
      return {
        id: user.warehouse_id,
        name: user.warehouse,
      };
    }
  };

  const currentWarehouse = getCurrentWarehouse();
  const warehouse = invoiceData?.warehouse || currentWarehouse; // Ensure warehouse is defined

  // ---------- Unpack from PaymentModal ----------
  const {
    paymentMethod,
    cashReceived,
    change,
    totalAmount,
    mspNo,
    customerName,
    customerAddress,
    customerPhone,
    warehouseName,
    warehouseAddress,
    warehousePhone,
    warehouseCity,
    warehouseRegion,
    warehouseEmail,
    handledBy,
    transactionDate,
    transactionTypeName,
    rows = [],
    actualSales,
    emptiesPriceTotal,
    emptyReturns,
    emptyDiscrepancies,
    expensesTotal = 0,
    miscItems = [],
    remarks = "",
    amountDue,
    expectedSale = 0,
    totalReturnedWithContent = 0,
    totalDiscrepancyNonEmpty = 0,
    totalActualRetrievedVL = 0,
    overallTotalVL = 0,
    grandTotalVL = 0,
    transactionTypes = "",
  } = invoiceData;

  const isVanLoad = /van\s*load/i.test(String(transactionTypeName || ""));
  const isWarehouse = /warehouse/i.test(String(transactionTypeName || ""));

  // PDF Generation sizes: KathPDF
  const [paper, setPaper] = useState(localStorage.getItem("pdf_paper") || "long"); // short | long | a4 | letter | legal | f4
  const [orientation, setOrientation] = useState(localStorage.getItem("pdf_orientation") || "portrait");

  useEffect(() => localStorage.setItem("pdf_paper", paper), [paper]);
  useEffect(() => localStorage.setItem("pdf_orientation", orientation), [orientation]);

  // ---------- Auto-generate invoice number ----------
  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const time = Date.now().toString().slice(-4);
    return `INV-${year}${month}${day}-${time}`;
  };

  const [invoiceNumber] = useState(() => invoiceData?.invoice_no || generateInvoiceNumber());

  // ---------- Helper functions ----------
  const n = (v) => Number(v || 0);
  const fmt = (v) => n(v).toFixed(2);

  // ---- VAN LOAD totals (same math as PaymentModal)
  const vl_actual = n(actualSales);
  const vl_retWc = n(totalReturnedWithContent);
  const vl_discNE = n(totalDiscrepancyNonEmpty);
  const vl_discE = n(emptyDiscrepancies);

  const vl_totalActualRetrieved_calc = vl_actual + vl_retWc + vl_discNE;
  const vl_totalActualRetrieved_final = n(totalActualRetrievedVL) || vl_totalActualRetrieved_calc;

  const vl_overallTotal_calc = vl_actual + vl_discE + vl_discNE;
  const vl_overallTotal_final = n(overallTotalVL) || vl_overallTotal_calc;

  const vl_grandTotal_calc = vl_overallTotal_final - n(expensesTotal);
  const vl_grandTotal_final = n(grandTotalVL) || vl_grandTotal_calc;

  const pickNum = (...vals) => {
    for (const v of vals) {
      if (v !== "" && v !== null && v !== undefined) {
        const num = Number(v);
        if (!Number.isNaN(num)) return num;
      }
    }
    return 0;
  };

  // Enhanced warehouse getters with localStorage fallback
  const getWarehouseName = () => {
    const possibleNames = [
      warehouseName,
      warehouse?.warehouse,
      invoiceData.currentWarehouse?.name,
      currentWarehouse?.warehouse,
      currentWarehouse?.name,
      "Warehouse",
    ];

    for (const name of possibleNames) {
      if (name && name.trim() !== "" && name.trim() !== "Warehouse") {
        return name;
      }
    }

    return currentWarehouse?.warehouse || currentWarehouse?.name || "Warehouse";
  };

  const getWarehouseAddress = () => {
    const possibleAddresses = [
      warehouseAddress,
      warehouse?.address,
      invoiceData.currentWarehouse?.address,
      currentWarehouse?.address,
    ];

    for (const addr of possibleAddresses) {
      if (addr && addr.trim() !== "") {
        return addr;
      }
    }
    return "";
  };

  const getWarehouseCity = () => {
    const possibleCities = [
      warehouseCity,
      warehouse?.city,
      invoiceData.currentWarehouse?.city,
      currentWarehouse?.city,
    ];

    for (const city of possibleCities) {
      if (city && city.trim() !== "") {
        return city;
      }
    }
    return "";
  };

  const getWarehouseRegion = () => {
    const possibleRegions = [
      warehouseRegion,
      warehouse?.region,
      invoiceData.currentWarehouse?.region,
      currentWarehouse?.region,
    ];

    for (const region of possibleRegions) {
      if (region && region.trim() !== "") {
        return region;
      }
    }
    return "";
  };

  const getWarehousePhone = () => {
    const possiblePhones = [
      warehousePhone,
      warehouse?.phone,
      invoiceData.currentWarehouse?.phone,
      currentWarehouse?.phone,
    ];

    for (const phone of possiblePhones) {
      if (phone && phone.trim() !== "") {
        return phone;
      }
    }
    return "";
  };

  const getWarehouseEmail = () => {
    const possibleEmails = [
      warehouseEmail,
      warehouse?.email,
      invoiceData.currentWarehouse?.email,
      currentWarehouse?.email,
    ];

    for (const email of possibleEmails) {
      if (email && email.trim() !== "") {
        return email;
      }
    }
    return "";
  };

  const getWarehouseFullAddress = () => {
    const parts = [];
    const addr = getWarehouseAddress();
    const city = getWarehouseCity();
    const region = getWarehouseRegion();

    if (addr) parts.push(addr);
    if (city) parts.push(city);
    if (region) parts.push(region);

    return parts.join(", ");
  };

  // Product helper functions
  const getProdName = (r) => r.productName || r.product_name || r.product_detail?.product_name || "--";

  const getDispatchedShell = (r) => pickNum(r.dispatchedShell, r.dispatched_shell);
  const getDispatchedPcs = (r) => pickNum(r.dispatchedPcs, r.dispatched_pcs);
  const getSoldShell = (r) => pickNum(r.soldShell, r.sold_shell);
  const getSoldPcs = (r) => pickNum(r.soldPcs, r.sold_pcs, r.qty, r.quantity);

  const getUnitPrice = (r) => pickNum(r.unitPrice, r.selling_price, r.price);
  const getDiscountPercent = (r) => pickNum(r.discount_percent, r.discount);
  const getDiscountAmount = (r) => pickNum(r.discount_amount, r.discount_amt);

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
    return Number((shell * getEmptyShellPrice(r) + pcs * getEmptyBottlePrice(r)).toFixed(2));
  };

  const rowReturnsValue = (r) => {
    const shells = getReturnedShells(r);
    const pcs = getReturnedPcs(r);
    return Number((shells * getEmptyShellPrice(r) + pcs * getEmptyBottlePrice(r)).toFixed(2));
  };

  const tableRows = (rows || []).filter(
    (r) =>
      getProdName(r) !== "--" ||
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

  const handleClose = async () => {
    if (isViewOnly) {
      onClose?.();
      navigate("/trading", { replace: true });
      return;
    }

    if (!saleId) {
      console.warn("⚠️ InvoiceModal: no saleId provided.");
      onClose?.();
      navigate("/trading", { replace: true });
      return;
    }

    if (!invoiceNumber) {
      showCustomAlert("Cannot save invoice: invoice number is empty.");
      return;
    }

    try {
      const token = localStorage.getItem("authToken");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Token ${token}` } : {}),
      };

      console.log("📤 Saving invoice for merchandising ID:", saleId, "Invoice No:", invoiceNumber);

      const res = await api.post(
        `/merchandising-set/${saleId}/set_invoice_no/`,
        {
          invoice_no: invoiceNumber,
          empties_price_total: emptiesPriceTotal,
          empty_returns: emptyReturns,
          payment_method: paymentMethod,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
        }
      );

      const responseBody = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("❌ Save invoice failed:", res.status, responseBody);
        showCustomAlert(responseBody?.detail || JSON.stringify(responseBody) || "Failed to save invoice number. See console.");
        return;
      }

      console.log("✅ Invoice saved:", responseBody);

      const isWarehouse = /warehouse/i.test(String(transactionTypeName || ""));

      if (isWarehouse) {
        const warehouseType = Array.isArray(transactionTypes)
          ? transactionTypes.find((tt) => tt.name === "Warehouse")
          : null;

        navigate("/merchandising-sale", {
          replace: true,
          state: {
            reset: true,
            transactionTypeId: warehouseType?.id || "",
          },
        });
      } else {
        navigate("/trading", { replace: true, state: { reset: true } });
      }

      onClose?.();
    } catch (err) {
      console.error("🔥 Network error saving invoice:", err);
      showCustomAlert("Network error while saving invoice. Check console.");
    }
  };

  const handleNewSale = () => {
    onClose?.();
    localStorage.removeItem("merchForm");

    const warehouseType = Array.isArray(transactionTypes)
      ? transactionTypes.find((tt) => tt.name === "Warehouse")
      : null;

    navigate("/merchandising-sale", {
      replace: true,
      state: {
        reset: true,
        transactionTypeId: warehouseType?.id || "",
      },
    });
  };

  const buildInvoicePdfPayload = () => ({
    invoiceNumber,
    paymentMethod,
    transactionDate,
    handledBy,
    mspNo,
    transactionTypeName,
    remarks,
    customer: {
      name: customerName || "Walk-in",
      address: customerAddress || "",
      phone: customerPhone || "",
    },
    warehouse: {
      name: getWarehouseName(),
      fullAddress: getWarehouseFullAddress(),
      phone: getWarehousePhone(),
      email: getWarehouseEmail(),
    },
    totals: {
      actualSales: n(actualSales),
      emptiesPriceTotal: n(emptiesPriceTotal),
      emptyReturns: n(emptyReturns),
      emptyDiscrepancies: n(emptyDiscrepancies),
      expensesTotal: n(expensesTotal),
      totalAmount: n(totalAmount),
      cashReceived: n(cashReceived),
      change: n(change),
      amountDue: n(amountDue) || n(totalAmount),
      isVanLoad,
      isWarehouse,
      expectedSale: n(expectedSale),
      vl_actual,
      vl_retWc,
      vl_discNE,
      vl_discE,
      vl_totalActualRetrieved: vl_totalActualRetrieved_final,
      vl_overallTotal: vl_overallTotal_final,
      vl_grandTotal: vl_grandTotal_final,
    },
    tables: {
      products: tableRows.map((r) => ({
        product: getProdName(r),
        dispatchedShell: getDispatchedShell(r),
        dispatchedPcs: getDispatchedPcs(r),
        soldShell: getSoldShell(r),
        soldPcs: getSoldPcs(r),
        unitPrice: getUnitPrice(r),
        discountPercent: getDiscountPercent(r),
        amount: getRowActual(r),
        expenses: (miscItems || []).map((e) => ({
          description: e.description,
          amount: Number(e.amount || 0),
        })),
      })),
      empties: tableRows.map((r) => ({
        product: getProdName(r),
        shellPrice: getEmptyShellPrice(r),
        bottlePrice: getEmptyBottlePrice(r),
        totalShells: getSoldShell(r),
        totalPieces: getSoldPcs(r),
        amount: rowEmptiesValue(r),
      })),
      returns: tableRows.map((r) => ({
        product: getProdName(r),
        shellPrice: getEmptyShellPrice(r),
        bottlePrice: getEmptyBottlePrice(r),
        returnedShells: getReturnedShells(r),
        returnedPieces: getReturnedPcs(r),
        amount: rowReturnsValue(r),
      })),
    },
  });

  const handleDownloadPDF = async () => {
    try {
      const payload = buildInvoicePdfPayload();
      await downloadInvoicePDF(payload);
      showCustomAlert("PDF downloaded successfully!");
    } catch (error) {
      console.error("PDF generation error:", error);
      showCustomAlert("Error generating PDF. Please try again.");
    }
  };

  const handlePrintInvoice = () => {
    const payload = buildInvoicePdfPayload(); // reuse payload logic
    printReceipt(payload, { width: "58mm" });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-5xl p-6 rounded-lg overflow-y-auto max-h-[90vh] shadow-lg relative">
        {/* Top Buttons */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={handleNewSale}
            className="bg-gray-100 text-black px-3 py-1 rounded hover:bg-gray-200"
          >
            🏠 New Sale
          </button>
          <div className="space-x-2">
            <label className="text-sm">
              Paper:
              <select
                value={paper}
                onChange={(e) => setPaper(e.target.value)}
                className="ml-1 border px-2 py-1 rounded text-sm"
              >
                <option value="short">Short (8.5×11)</option>
                <option value="long">Long (8.5×13)</option>
                <option value="legal">Legal (8.5×14)</option>
                <option value="letter">Letter</option>
                <option value="a4">A4</option>
                <option value="f4">F4 (8.5×13)</option>
              </select>
            </label>

            <label className="text-sm">
              Orientation:
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value)}
                className="ml-1 border px-2 py-1 rounded text-sm"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>
            <button
              onClick={handleDownloadPDF}
              className="bg-white border border-gray-300 px-3 py-1 rounded hover:bg-gray-100"
            >
              ⬇️ Download PDF
            </button>
            <button
              onClick={handlePrintInvoice}
              className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
            >
              🖨️ Print Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
