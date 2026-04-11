// src/components/InvoiceModal.jsx
import React, { useEffect, useState} from "react";
import { useNavigate } from "react-router-dom";
import { downloadInvoicePDF } from "./PDFInvoice"; // ⬅️ new import
// In src/components/InvoiceModal.jsx (same folder as receiptPrint.jsx)
import { printReceipt } from "./receiptPrint.jsx"; // Make sure the file name is exactly 'receiptPrint.jsx'
import "react-toastify/dist/ReactToastify.css"
import api from "../api"; // Assuming this is where your api helper is
import ModalShell from "./common/ModalShell";
import { showAppAlertDialog } from "./common/modalDialogs";




const InvoiceModal = ({ 
  onClose,
  invoiceData = {}, 
  hidePaymentBreakdown = false,
  isViewOnly = false,
 }) => {

  // ✅ DEBUG: Log invoiceData warehouse when component renders (en)
  console.log("🧾 InvoiceModal received invoiceData.warehouse:", invoiceData.warehouse);
  console.log("🧾 InvoiceModal invoiceData.warehouse type:", typeof invoiceData.warehouse);
  console.log("🧾 InvoiceModal invoiceData.warehouse keys:", invoiceData.warehouse ? Object.keys(invoiceData.warehouse) : "null/undefined");
  console.log("🧾 InvoiceModal invoiceData.warehouse phone:", invoiceData.warehouse?.phone);

  const navigate = useNavigate();
  const saleId = invoiceData?.id || null;

                    // id of Merchandising record

  // small helper using your showCustomAlert (you already have this function)
  const showAlert = (msg) => showCustomAlert ? showCustomAlert(msg) : alert(msg);

  // Get warehouse info from localStorage as fallback if not in props
  const getCurrentWarehouse = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    const role = String(user.role || "").toLowerCase();

    if (role.includes("admin")) {
      return (
        selectedWarehouse || {
          id: user.warehouse_id,
          name: user.warehouse,
          warehouse: user.warehouse,
        }
      );
    } else {
      return {
        id: user.warehouse_id,
        name: user.warehouse,
        warehouse: user.warehouse,
      };
    }
  };

  const currentWarehouse = getCurrentWarehouse();

  // ---------- unpack from PaymentModal ----------
  const {
    paymentMethod,
    cashReceived,
    change,
    totalAmount,

    // header / context
    mspNo,
    customerName,
    customerAddress,
    customerPhone,

    // warehouse data from merchandising.warehouse_id -> warehouse table
    warehouseName,
    warehouseAddress,
    warehousePhone,
    warehouseCity,
    warehouseRegion,
    warehouseEmail,
    warehouse_full_address,

    // Additional possible warehouse field names
    warehouse,
    warehouse_name,
    warehouse_address,
    warehouse_phone,
    warehouse_city,
    warehouse_region,
    warehouse_email,

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
    miscItems = [],
    remarks = "",

    // Route and Van information
    route,
    van,
    route_name,
    van_name,

    amountDue, // final due from PaymentModal

    // Van Load breakdown pieces
    expectedSale = 0,
    totalReturnedWithContent = 0,
    totalDiscrepancyNonEmpty = 0,
    totalActualRetrievedVL = 0,
    overallTotalVL = 0,
    grandTotalVL = 0,

    transactionTypes = "", //Kath
  } = invoiceData;

  // ✅ DEBUG: Log destructured warehouse fields (en)
  console.log("🏪 InvoiceModal destructured warehouse fields:");
  console.log("warehouse_phone:", warehouse_phone);
  console.log("warehouse_name:", warehouse_name);
  console.log("warehouse_address:", warehouse_address);
  console.log("warehouse:", warehouse);

  const hasText = (value) =>
    value !== null && value !== undefined && String(value).trim() !== "";
  const toText = (value) => (value === null || value === undefined ? "" : String(value).trim());
  const toWarehouseId = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const resolvedWarehouseId =
    toWarehouseId(invoiceData?.warehouse_id) ??
    toWarehouseId(warehouse?.id) ??
    toWarehouseId(warehouse?.warehouse_id) ??
    toWarehouseId(typeof warehouse === "number" ? warehouse : null) ??
    toWarehouseId(invoiceData?.currentWarehouse?.id) ??
    toWarehouseId(currentWarehouse?.id);

  const [resolvedWarehouseDetails, setResolvedWarehouseDetails] = useState(null);

  useEffect(() => {
    if (!resolvedWarehouseId) {
      setResolvedWarehouseDetails(null);
      return;
    }

    let isMounted = true;

    api
      .get(`/warehouses/${resolvedWarehouseId}/`)
      .then((res) => {
        if (!isMounted) return;
        const wh = res?.data || {};
        const streetAddress = wh.street_address || wh.address || "";
        const cityName = wh.city || "";
        const regionName = wh.region || "";
        const fullAddress = wh.full_address || [streetAddress, cityName, regionName].filter(Boolean).join(", ");

        setResolvedWarehouseDetails({
          id: wh.id || resolvedWarehouseId,
          name: wh.name || wh.warehouse || "",
          address: streetAddress,
          city: cityName,
          region: regionName,
          phone: wh.phone_number || wh.phone || "",
          email: wh.email || "",
          fullAddress,
        });
      })
      .catch(() => {
        if (isMounted) {
          setResolvedWarehouseDetails(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [resolvedWarehouseId]);

  const isVanLoad = /van\s*load/i.test(String(transactionTypeName || ""));
  const isWarehouse = /warehouse/i.test(String(transactionTypeName || ""));

  //PDF Generation sizes: KathPDF
  const [paper, setPaper] = useState(localStorage.getItem("pdf_paper") || "long");       // short | long | a4 | letter | legal | f4
  const [orientation, setOrientation] = useState(localStorage.getItem("pdf_orientation") || "portrait");

// remember last choice
useEffect(() => localStorage.setItem("pdf_paper", paper), [paper]);
useEffect(() => localStorage.setItem("pdf_orientation", orientation), [orientation]);

  // ---------- Auto-generate invoice number (always generate, don't use mspNo) ----------
  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const time = Date.now().toString().slice(-4);
    return `INV-${year}${month}${day}-${time}`;
  };

const [invoiceNumber] = useState(() => invoiceData?.invoice_no || generateInvoiceNumber());

  // ---------- helpers ----------
  const n = (v) => Number(v || 0);
  const fmt = (v) =>
    n(v).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

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
      warehouse_name,
      resolvedWarehouseDetails?.name,
      warehouse?.warehouse,
      warehouse?.name,
      warehouse?.warehouse_name,
      invoiceData.currentWarehouse?.name,
      invoiceData.currentWarehouse?.warehouse,
      currentWarehouse?.warehouse,
      currentWarehouse?.name,
      invoiceData.warehouse_name, // ✅ Add direct invoiceData field (en)
      "Warehouse",
    ];

    for (const name of possibleNames) {
      const cleanName = toText(name);
      if (cleanName && cleanName.toLowerCase() !== "warehouse") {
        return cleanName;
      }
    }

    return currentWarehouse?.warehouse || currentWarehouse?.name || "Warehouse";
  };

  const getWarehouseAddress = () => {
    const possibleAddresses = [
      warehouseAddress,
      warehouse_address,
      resolvedWarehouseDetails?.address,
      warehouse?.address,
      warehouse?.street_address, // ✅ Add WarehouseSerializer field (en)
      invoiceData.currentWarehouse?.address,
      currentWarehouse?.address,
      invoiceData.warehouse_address, // ✅ Add direct invoiceData field (en)
    ];

    for (const addr of possibleAddresses) {
      if (hasText(addr)) {
        return toText(addr);
      }
    }
    return "";
  };

  const getWarehouseCity = () => {
    const possibleCities = [
      warehouseCity,
      warehouse_city,
      resolvedWarehouseDetails?.city,
      warehouse?.city,
      invoiceData.currentWarehouse?.city,
      currentWarehouse?.city,
    ];

    for (const city of possibleCities) {
      if (hasText(city)) {
        return toText(city);
      }
    }
    return "";
  };

  const getWarehouseRegion = () => {
    const possibleRegions = [
      warehouseRegion,
      warehouse_region,
      resolvedWarehouseDetails?.region,
      warehouse?.region,
      invoiceData.currentWarehouse?.region,
      currentWarehouse?.region,
    ];

    for (const region of possibleRegions) {
      if (hasText(region)) {
        return toText(region);
      }
    }
    return "";
  };

  //(en)
  const getWarehousePhone = () => {
    console.log("🔍 getWarehousePhone debugging:");
    console.log("warehousePhone:", warehousePhone);
    console.log("warehouse_phone:", warehouse_phone);
    console.log("warehouse?.phone:", warehouse?.phone);
    console.log("invoiceData.currentWarehouse?.phone:", invoiceData.currentWarehouse?.phone);
    console.log("currentWarehouse?.phone:", currentWarehouse?.phone);
    console.log("Full warehouse object:", warehouse);
    console.log("Full invoiceData:", invoiceData);

    const possiblePhones = [
      warehousePhone,
      warehouse_phone,
      resolvedWarehouseDetails?.phone,
      warehouse?.phone,
      warehouse?.phone_number, // ✅ Add phone_number field
      invoiceData.currentWarehouse?.phone,
      currentWarehouse?.phone,
      invoiceData.warehouse_phone, // ✅ Add direct invoiceData field
    ];

    for (const phone of possiblePhones) {
      if (hasText(phone)) {
        const cleanPhone = toText(phone);
        console.log("✅ Found phone:", cleanPhone);
        return cleanPhone;
      }
    }
    console.log("❌ No phone found");
    return "";
  };

  const getWarehouseEmail = () => {
    const possibleEmails = [
      warehouseEmail,
      warehouse_email,
      resolvedWarehouseDetails?.email,
      warehouse?.email,
      invoiceData.currentWarehouse?.email,
      currentWarehouse?.email,
      invoiceData.warehouse_email,
    ];

    for (const email of possibleEmails) {
      if (hasText(email)) {
        return toText(email);
      }
    }
    return "";
  };

  //(en)
  const getWarehouseFullAddress = () => {
    // First check if we have the pre-constructed full address from backend
    const possibleFullAddresses = [
      warehouse_full_address,
      invoiceData.warehouse_full_address,
      resolvedWarehouseDetails?.fullAddress,
    ];
    for (const fullAddr of possibleFullAddresses) {
      if (hasText(fullAddr)) {
        return toText(fullAddr);
      }
    }

    // Fallback to constructing it from parts
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
  const getProdName = (r) =>
    r.productName || r.product_name || r.product_detail?.product_name || "--";

  const getDispatchedShell = (r) => pickNum(r.dispatchedShell, r.dispatched_shell);
  const getDispatchedPcs = (r) => pickNum(r.dispatchedPcs, r.dispatched_pcs);
  const getSoldShell = (r) => pickNum(r.soldShell, r.sold_shell);
  const getSoldPcs = (r) => pickNum(r.soldPcs, r.sold_pcs, r.qty, r.quantity);

  const getUnitPrice = (r) => pickNum(r.unitPrice, r.selling_price, r.price);
  const getDiscountPercent = (r) => pickNum(r.discount_percent, r.discount);
  const getDiscountAmount = (r) => pickNum(r.discount_amount, r.discount_amt);

  // Get discount amount in pesos (new function)
  const getDiscountAmountInPesos = (r) => {
    const unitPrice = getUnitPrice(r);
    const soldPcs = getSoldPcs(r);
    const discountPercent = getDiscountPercent(r);

    return (unitPrice * soldPcs * discountPercent) / 100;
  };

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
    return;
  }

  if (!saleId) {
    console.warn("⚠️ InvoiceModal: no saleId provided.");
    onClose?.();
    navigate("/trading", { replace: true });
    return;
  }

  if (!invoiceNumber) {
    showAlert("Cannot save invoice: invoice number is empty.");
    return;
  }

  try {
    const token = localStorage.getItem("authToken");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
    };

    console.log("📤 Saving invoice for merchandising ID:", saleId, "Invoice No:", invoiceNumber);

    // Using the API helper instead of fetch
    const res = await api.post(
      `/merchandising-set/${saleId}/set_invoice_no/`,
      {
        invoice_no: invoiceNumber,
        empties_price_total: emptiesPriceTotal,
        empty_returns: emptyReturns,
        payment_method: paymentMethod,
      },
      { headers }
    );

    if (res.status !== 200) {
      console.error("❌ Save invoice failed:", res.status, res.data);
      showAlert(res.data?.detail || JSON.stringify(res.data) || "Failed to save invoice number.");
      return;
    }

    console.log("✅ Invoice saved:", res.data);

    navigate("/trading", { replace: true, state: { reset: true } });

    onClose?.();
  } catch (err) {
    console.error("🔥 Network error saving invoice:", err);
    showAlert("Network error while saving invoice. Check console.");
  }
};






  // ✅ Navigate to fresh sale
  // const handleNewSale = () => {
  //   onClose?.();
  //   localStorage.removeItem("merchForm");
  //   navigate("/merchandising-sale", { replace: true, state: { reset: true } });
  // }; Kath
  const handleNewSale = () => {
    onClose?.();
    localStorage.removeItem("merchForm");

    // Make sure transactionTypes is an array before calling find
    const warehouseType = Array.isArray(transactionTypes)
      ? transactionTypes.find(tt => tt.name === "Warehouse")
      : null;

    navigate("/merchandising-sale", {
      replace: true,
      state: {
        reset: true,
        transactionTypeId: warehouseType?.id || ""
      }
    });
  }; //Kath


  // ------- NEW: build payload for external PDF module -------
  const buildInvoicePdfPayload = () => ({
    invoiceNumber,
    paymentMethod,
    transactionDate,
    handledBy,
    mspNo,
    transactionTypeName,
    remarks,

    // Add individual warehouse fields for receipt printing fallback
    warehouse_address: getWarehouseAddress(),
    warehouse_city: getWarehouseCity(),
    warehouse_region: getWarehouseRegion(),
    warehouse_phone: getWarehousePhone(),
    warehouse_email: getWarehouseEmail(),
    warehouse_full_address: getWarehouseFullAddress(),

    customer: {
      name: customerName || "Walk-in",
      address: customerAddress || "",
      phone: customerPhone || "",
    },

    warehouse: {
      name: getWarehouseName() || currentWarehouse?.name || "Warehouse",
      fullAddress: getWarehouseFullAddress() || 
        resolvedWarehouseDetails?.fullAddress ||
        (currentWarehouse ? `${currentWarehouse.address || ""} ${currentWarehouse.city || ""} ${currentWarehouse.region || ""}`.trim().replace(/\s+/g, " ") : "") ||
        "Warehouse Address",
      phone: getWarehousePhone() || resolvedWarehouseDetails?.phone || currentWarehouse?.phone || "",
      email: getWarehouseEmail() || resolvedWarehouseDetails?.email || currentWarehouse?.email || "",
      // Add individual fields for fallback in receipt printing
      address: getWarehouseAddress(),
      city: getWarehouseCity(),
      region: getWarehouseRegion(),
    },

    route: {
      id: route,
      name: route_name || route?.name || "",
    },

    van: {
      id: van,
      name: van_name || van?.name || "",
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
        discountAmountInPesos: getDiscountAmountInPesos(r), 
        discountPercent: getDiscountPercent(r),
        amount: getRowActual(r),
        // jelyn changes start
        expenses: (miscItems || []).map(e => ({
        description: e.description,
        amount: Number(e.amount || 0),
       })),
      //  jelyn changes ends here
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

  // ------- REPLACED: PDF generation now calls external module -------
  const handleDownloadPDF = async () => {
    try {
      const payload = buildInvoicePdfPayload();
      await downloadInvoicePDF(payload, {
        paper,
        orientation,
      });
      showCustomAlert("PDF downloaded successfully!");
    } catch (error) {
      console.error("PDF generation error:", error);
      showCustomAlert("Error generating PDF. Please try again.");
    }
  };
//(en)
  const handlePrintInvoice = () => {
    console.log("🧾 Building invoice payload for printing...");
    console.log("🧾 invoiceData:", invoiceData);
    console.log("🧾 warehouse_phone from invoiceData:", invoiceData.warehouse_phone);
    console.log("🧾 warehouse from invoiceData:", invoiceData.warehouse);
    const payload = buildInvoicePdfPayload();   // ✅ reuse what you already have
    console.log("🧾 Final payload warehouse:", payload.warehouse);
    // Optional: pass "80mm" if you use wider paper
    printReceipt(payload, { width: "58mm" });   // or { width: "80mm", cols: 48 }
  };

  // const handleSaveInvoice = async () => {
  //   const invoiceData = {
  //     invoice_no: invoiceNumber,
  //     customer_name: customerName,
  //     total_amount: totalAmount,
  //     status: "Pending"
  //   };

  //   try {
  //     await fetch("http://localhost:8080/api/invoices/", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify(invoiceData),
  //     });
  //     alert("Invoice saved!");
  //   } catch (err) {
  //     console.error("Error saving invoice:", err);
  //   }
  // };

  const showCustomAlert = (message) => {
    showAppAlertDialog({
      message,
      okLabel: "OK",
      size: "sm",
    });
  };

  // ✅ Subtotal logic
const subtotalFromRows = tableRows.reduce((sum, r) => sum + getRowActual(r), 0);
// Prefer backend actualSales if > 0, else use calculated rows
const subtotal = n(actualSales) > 0 ? n(actualSales) : subtotalFromRows;

  return (
    <ModalShell
      open
      onClose={onClose}
      size="2xl"
      closeOnOverlay={false}
      panelClassName="bg-white w-full max-w-5xl p-6 rounded-lg overflow-y-auto max-h-[90vh] shadow-lg relative"
    >
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


        {/* From / To / Meta */}
        <div className="mt-4 text-sm">
          <div className="grid grid-cols-2 gap-6">
  
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-6 p-4 bg-gray-50 rounded-lg">
            <p>
              <strong>Invoice No:</strong> {invoiceNumber}
            </p>
            <p>
              <strong>Date:</strong> {formatLocalToManila(transactionDate) || "--"}
            </p>
            <p>
              <strong>Payment Method:</strong>{" "}
              {paymentMethod ? paymentMethod.toUpperCase() : "--"}
            </p>
            <p>
              <strong>Handled By:</strong> {handledBy || "--"}
            </p>
          </div>

          {mspNo && (
            <div className="mt-2 p-2 bg-yellow-50 rounded border-l-4 border-yellow-500">
              <strong>MSP Reference No:</strong> {mspNo}
            </div>
          )}

          <div className="mt-2">
            <strong>Transaction Type:</strong>
            <span
              className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                isVanLoad
                  ? "bg-purple-100 text-purple-700"
                  : isWarehouse
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {transactionTypeName || "Standard"}
            </span>
          </div>
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
                  <td className="border px-2 py-1">
                    {`${getDispatchedShell(row)} shells (${getDispatchedPcs(row)} pcs)`}
                  </td>
                  <td className="border px-2 py-1">
                    {`${getSoldShell(row)} shells (${getSoldPcs(row)} pcs)`}
                  </td>
                  <td className="border px-2 py-1">₱{fmt(getUnitPrice(row))}</td>
                  <td className="border px-2 py-1">₱{fmt(getDiscountAmountInPesos(row))}</td>
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
          <p className="text-right font-semibold mt-1">SUBTOTAL: ₱{fmt(emptiesPriceTotal)}</p>
        </div>

        {/* RETURNS */}
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
          <p className="text-right font-semibold mt-1">SUBTOTAL: ₱-{fmt(emptyReturns)}</p>
        </div>

      {/* Expenses Summary — only if NOT Warehouse */}
        {!isWarehouse && (
          <div className="mt-6 mb-6">
            <h3 className="font-semibold mb-2">Expenses Summary</h3>
            <table className="w-full mt-2 border">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-2 text-left">Description</th>
                  <th className="p-2 text-right">Amount (₱)</th>
                </tr>
              </thead>
              <tbody>
                {(miscItems || []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-2 text-center text-gray-500">
                      No expenses added
                    </td>
                  </tr>
                ) : (
                  miscItems.map((exp, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2 text-left">{exp.description}</td>
                      <td className="p-2 text-right">₱{Number(exp.amount || 0).toFixed(2)}</td>
                    </tr>
                  ))
                )}
                
              </tbody>
            </table>
                 <p className="text-right font-semibold mt-1">Total
               
                    ₱{(miscItems || [])
                      .reduce((s, i) => s + Number(i.amount || 0), 0)
                      .toFixed(2)}
                  </p>
          </div>
        )}


        {/* PAYMENT BREAKDOWN */}

         {!hidePaymentBreakdown && (
            <>
              <h4 className="font-bold mb-2 text-gray-700">PAYMENT BREAKDOWN</h4>
              <div className="mt-2 text-sm">
                <div className="flex flex-col bg-transparent p-6 border border-black">
                  {isVanLoad ? (
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
                            <span className="tabular-nums">₱{fmt(vl_totalActualRetrieved_final)}</span>
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
                            <span className="tabular-nums">₱{fmt(vl_overallTotal_final)}</span>
                          </div>

                          <div className="flex justify-between">
                            <span>Expenses:</span>
                            <span className="tabular-nums">- ₱{fmt(expensesTotal)}</span>
                          </div>

                          <div className="border-t border-gray-300 my-2"></div>

                          {(paymentMethod === "cash" || paymentMethod === "credit") && (
                        <div className="flex justify-between font-bold text-gray-800">
                          <span>Grand Total</span>
                          <span>₱{fmt(n(amountDue) || n(totalAmount))}</span>
                        </div>
                      )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    // WAREHOUSE layout
                    <div className="space-y-1">
                      <div className="font-semibold mb-2 flex justify-between">
                        <span>Actual Sales:</span>
                        <span className="tabular-nums">₱{fmt(actualSales)}</span>
                      </div>

                      <div className="border-t mt-2 pt-2 flex justify-between font-semibold">
                        <span>Discrepancy:</span>
                      </div>

                      <div className="flex justify-between">
                        <span>Empties Price Total:</span>
                        <span className="tabular-nums">₱{fmt(emptiesPriceTotal)}</span>
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
                        <span className="tabular-nums">+ ₱{fmt(actualSales)}</span>
                      </div>

                      {/* 🔹 Add a divider after Actual Sales */}
                      <div className="border-t border-gray-300 my-2"></div>

                      {/* Karen changes*/}
                      <div className="flex justify-between font-bold text-gray-800">
                        <span className="text-lg">Amount Due:</span>
                        <span className="text-3xl font-extrabold text-black">
                          ₱{fmt(n(amountDue) || n(totalAmount))}
                        </span>
                      </div>

                    </div>
                  )}

                  {/* Cash details (always shown if available) */}
                  {/* Payment Summary (dynamic based on payment method) */}
                    {/* 💰 Payment Summary (dynamic layout) */}
                    <div className="pt-4">
                      {paymentMethod === "cash+credit" ? (
                        // 🟦 Cash + Credit layout
                        <div className="bg-blue-50 border border-blue-300 rounded p-4 space-y-2">
                          <div className="flex justify-between font-semibold text-gray-800">
                            <span>Total Amount Due:</span>
                            <span>₱{fmt(n(amountDue) || n(totalAmount))}</span>
                          </div>

                          <div className="flex justify-between text-black-600 font-medium">
                            <span>Cash Received:</span>
                            <span>- ₱{fmt(cashReceived)}</span>
                          </div>

                          <div className="flex justify-between border-t border-blue-300 pt-2 font-bold text-blue-700">
                            <span>Total Amount Credit:</span>
                            <span>₱{fmt((n(amountDue) || n(totalAmount)) - n(cashReceived))}</span>
                          </div>
                        </div>
                      ) : (
                        // 🟩 Cash or Credit layout
                        <div className="">
                          <div className="pt-2 grid grid-cols-2 gap-2 text-sm">
                            <div className="flex flex-col">
                              <div>
                                <strong>Cash Received:</strong> ₱{fmt(cashReceived)}
                              </div>
                              <div className="mt-1">
                                <strong>Change:</strong> ₱{fmt(change)}
                              </div>
                            </div>
                            
                            {isVanLoad && remarks && (
                              <div className="col-span-2">
                                <strong>Remarks:</strong> {remarks}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {isVanLoad && remarks && (
                        <div className="mt-3">
                          <strong>Remarks:</strong> {remarks}
                        </div>
                      )}
                    </div>
                </div>
              </div>
            </>
          )}

        {/* Close */}
        <div className="text-right mt-6">
          <button
            onClick={handleClose}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            {isViewOnly ? "Close" : "Close"}
          </button>
        </div>
    </ModalShell>
  );
};

export default InvoiceModal;
