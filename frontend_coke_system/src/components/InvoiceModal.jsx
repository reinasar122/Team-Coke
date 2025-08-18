
import React from "react";
import { useNavigate } from "react-router-dom";

const InvoiceModal = ({ onClose, invoiceData = {} }) => {
  const navigate = useNavigate();

  // Get warehouse info from localStorage as fallback if not in props
  const getCurrentWarehouse = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    
    if (user.role?.toLowerCase() === "admin") {
      return selectedWarehouse || { 
        id: user.warehouse_id, 
        name: user.warehouse,
        warehouse: user.warehouse
      };
    } else {
      return { 
        id: user.warehouse_id, 
        name: user.warehouse,
        warehouse: user.warehouse
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
    warehouseId,
    warehouseName,
    warehouseAddress,
    warehousePhone,
    warehouseCity,
    warehouseRegion,
    warehouseEmail,
    
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
    remarks = "",
  } = invoiceData;

  const isVanLoad = (transactionTypeName || "").toLowerCase() === "van load";
  const isWarehouse = (transactionTypeName || "").toLowerCase() === "warehouse";

  // ---------- Auto-generate invoice number (always generate, don't use mspNo) ----------
  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = Date.now().toString().slice(-4);
    return `INV-${year}${month}${day}-${time}`;
  };

  const invoiceNumber = generateInvoiceNumber();

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

  // Enhanced warehouse getters with localStorage fallback
  const getWarehouseName = () => {
    const possibleNames = [
      warehouseName,
      warehouse_name,
      warehouse?.warehouse,
      warehouse?.name,
      warehouse?.warehouse_name,
      invoiceData.currentWarehouse?.name,
      invoiceData.currentWarehouse?.warehouse,
      // Fallback to localStorage warehouse
      currentWarehouse?.warehouse,
      currentWarehouse?.name,
      "Warehouse" // final fallback
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
      warehouse_address,
      warehouse?.address,
      invoiceData.currentWarehouse?.address,
      currentWarehouse?.address
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
      warehouse_city,
      warehouse?.city,
      invoiceData.currentWarehouse?.city,
      currentWarehouse?.city
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
      warehouse_region,
      warehouse?.region,
      invoiceData.currentWarehouse?.region,
      currentWarehouse?.region
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
      warehouse_phone,
      warehouse?.phone,
      invoiceData.currentWarehouse?.phone,
      currentWarehouse?.phone
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
      warehouse_email,
      warehouse?.email,
      invoiceData.currentWarehouse?.email,
      currentWarehouse?.email
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
    
    return parts.join(', ');
  };

  // Product helper functions
  const getProdName = (r) =>
    r.productName || r.product_name || r.product_detail?.product_name || "--";

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

    const pcs   = getSoldPcs(r);
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

  const handleClose = () => {
    onClose?.();
    navigate("/trading", { replace: true, state: { reset: true } });
  };

  // ✅ FIXED: Navigate to correct path with proper reset
  const handleNewSale = () => {
    onClose?.();
    // Clear any saved form data
    localStorage.removeItem("merchForm");
    // Navigate to merchandising-sale with clean state (correct path)
    navigate("/merchandising-sale", { replace: true, state: { reset: true } });
  };

  const handleDownloadPDF = async () => {
    try {
      // Check if jsPDF is already loaded
      if (window.jspdf) {
        generatePDF();
        return;
      }

      // Import jsPDF from CDN
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload = () => {
        generatePDF();
      };
      script.onerror = () => {
        showCustomAlert('Error loading PDF library. Please try again.');
      };
      document.head.appendChild(script);
    } catch (error) {
      console.error('Error loading PDF library:', error);
      showCustomAlert('Error generating PDF. Please try again.');
    }
  };

  const generatePDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Set font
    doc.setFont("helvetica");
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(59, 130, 246); // Blue color
    doc.text("INVOICE", 20, 30);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Invoice No: ${invoiceNumber}`, 20, 45);
    doc.text(`Date: ${formatLocalToManila(transactionDate) || "--"}`, 20, 55);
    doc.text(`Payment Method: ${paymentMethod ? paymentMethod.toUpperCase() : "--"}`, 20, 65);
    
    // From/To section
    doc.setFontSize(14);
    doc.text("From (Source Warehouse):", 20, 85);
    doc.setFontSize(10);
    doc.text(getWarehouseName(), 20, 95);
    if (getWarehouseFullAddress()) {
      doc.text(getWarehouseFullAddress(), 20, 105);
    }
    if (getWarehousePhone()) {
      doc.text(`Phone: ${getWarehousePhone()}`, 20, 115);
    }
    
    doc.setFontSize(14);
    doc.text("To (Customer):", 120, 85);
    doc.setFontSize(10);
    doc.text(customerName || "Walk-in", 120, 95);
    if (customerAddress) {
      doc.text(customerAddress, 120, 105);
    }
    
    // Products table
    let yPos = 140;
    doc.setFontSize(12);
    doc.text("SOLD PRODUCTS", 20, yPos);
    yPos += 10;
    
    // Table headers
    doc.setFontSize(8);
    doc.text("Product", 20, yPos);
    doc.text("Dispatched", 70, yPos);
    doc.text("Sold", 110, yPos);
    doc.text("Unit Price", 140, yPos);
    doc.text("Amount", 170, yPos);
    yPos += 10;
    
    // Table content
    tableRows.forEach((row) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(getProdName(row).substring(0, 20), 20, yPos);
      doc.text(`${getDispatchedShell(row)}s (${getDispatchedPcs(row)}p)`, 70, yPos);
      doc.text(`${getSoldShell(row)}s (${getSoldPcs(row)}p)`, 110, yPos);
      doc.text(`₱${fmt(getUnitPrice(row))}`, 140, yPos);
      doc.text(`₱${fmt(getRowActual(row))}`, 170, yPos);
      yPos += 8;
    });
    
    // Totals
    yPos += 10;
    doc.setFontSize(10);
    doc.text(`Actual Sales: ₱${fmt(actualSales)}`, 20, yPos);
    yPos += 8;
    doc.text(`Empties Price Total: ₱${fmt(emptiesPriceTotal)}`, 20, yPos);
    yPos += 8;
    doc.text(`Empty Returns: ₱-${fmt(emptyReturns)}`, 20, yPos);
    yPos += 8;
    doc.text(`Empty Discrepancies: ₱${fmt(emptyDiscrepancies)}`, 20, yPos);
    yPos += 10;
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Amount Due: ₱${fmt(totalAmount)}`, 20, yPos);
    yPos += 10;
    doc.text(`Cash Received: ₱${fmt(cashReceived)}`, 20, yPos);
    yPos += 8;
    doc.text(`Change: ₱${fmt(change)}`, 20, yPos);
    
    // Download the PDF
    doc.save(`Invoice_${invoiceNumber}.pdf`);
    showCustomAlert('PDF downloaded successfully!');
  };

  const handlePrintInvoice = () => {
    // Create a new window with the invoice content for printing
    const printWindow = window.open('', '_blank');
    const printContent = generatePrintHTML();
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  const generatePrintHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoiceNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: black; }
          .header { background-color: #3b82f6; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; position: relative; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 5px 0; }
          .status-badge { position: absolute; top: 20px; right: 20px; padding: 8px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }
          .section { margin-bottom: 20px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
          .info-box { background-color: #f3f4f6; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6; }
          .customer-box { border-left-color: #059669; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 10px; }
          th { background-color: #f3f4f6; font-weight: bold; }
          .totals { background-color: #f9fafb; padding: 15px; border-radius: 8px; }
          .total-amount { font-size: 18px; font-weight: bold; color: #059669; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>INVOICE</h1>
          <p>Invoice No: ${invoiceNumber}</p>
          <span class="status-badge" style="background: ${paymentMethod === "credit" ? "#eab308" : "#10b981"};">
            ${paymentMethod === "credit" ? "CREDIT" : "PAID"}
          </span>
        </div>

        <div class="grid">
          <div class="info-box">
            <h3 style="color: #3b82f6; margin-top: 0;">From (Source Warehouse):</h3>
            <h2 style="color: #1e40af; margin: 10px 0;">${getWarehouseName()}</h2>
            ${getWarehouseFullAddress() ? `<p>📍 ${getWarehouseFullAddress()}</p>` : ''}
            ${getWarehousePhone() ? `<p>📞 ${getWarehousePhone()}</p>` : ''}
            ${getWarehouseEmail() ? `<p>✉️ ${getWarehouseEmail()}</p>` : ''}
          </div>
          <div class="info-box customer-box">
            <h3 style="color: #059669; margin-top: 0;">To (Customer):</h3>
            <h2 style="color: #047857; margin: 10px 0;">${customerName || "Walk-in"}</h2>
            ${customerAddress ? `<p>📍 ${customerAddress}</p>` : ''}
            ${customerPhone ? `<p>📞 ${customerPhone}</p>` : ''}
          </div>
        </div>

        <div class="section">
          <p><strong>Invoice No:</strong> ${invoiceNumber} | <strong>Date:</strong> ${formatLocalToManila(transactionDate) || "--"} | <strong>Handled By:</strong> ${handledBy || "--"}</p>
          ${mspNo ? `<p style="background: #fef3c7; padding: 10px; border-left: 4px solid #f59e0b; border-radius: 4px;"><strong>MSP Reference No:</strong> ${mspNo}</p>` : ''}
        </div>

        <div class="section">
          <h3>SOLD PRODUCTS</h3>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Dispatched</th>
                <th>Sold</th>
                <th>Unit Price</th>
                <th>Discount (%)</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows.map(row => `
                <tr>
                  <td>${getProdName(row)}</td>
                  <td>${getDispatchedShell(row)} shells (${getDispatchedPcs(row)} pcs)</td>
                  <td>${getSoldShell(row)} shells (${getSoldPcs(row)} pcs)</td>
                  <td>₱${fmt(getUnitPrice(row))}</td>
                  <td>${fmt(getDiscountPercent(row))}</td>
                  <td>₱${fmt(getRowActual(row))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p style="text-align: right; font-weight: bold;">SUBTOTAL: ₱${fmt(actualSales)}</p>
        </div>

        <div class="totals">
          <div><strong>Actual Sales:</strong> ₱${fmt(actualSales)}</div>
          <div>- Empties Price Total: ₱${fmt(emptiesPriceTotal)}</div>
          <div>- Empty Returns: ₱-${fmt(emptyReturns)}</div>
          <div>- Empty Discrepancies: ₱${fmt(emptyDiscrepancies)}</div>
          ${isVanLoad ? `<div>- Expenses: ₱${fmt(expensesTotal)}</div>` : ''}
          <div class="total-amount">Total Amount Due: ₱${fmt(totalAmount)}</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
            <div><strong>Cash Received:</strong> ₱${fmt(cashReceived)}</div>
            <div><strong>Change:</strong> ₱${fmt(change)}</div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const showCustomAlert = (message) => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
        <p class="text-gray-700 dark:text-gray-300 mb-4">${message}</p>
        <div class="flex justify-end">
          <button class="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded" onclick="this.closest('.fixed').remove()">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
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

        {/* Header */}
        <div className="bg-blue-500 text-white p-4 rounded-md flex justify-between items-center relative">
          <div>
            <h2 className="text-lg font-bold">INVOICE</h2>
            <p className="text-sm">Invoice No: {invoiceNumber}</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded absolute top-4 right-4 ${
            paymentMethod === "credit" ? "bg-yellow-500" : "bg-green-500"
          }`}>
            {paymentMethod === "credit" ? "CREDIT" : "PAID"}
          </span>
        </div>

        {/* From / To / Meta */}
        <div className="mt-4 text-sm">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-600 mb-2">From (Source Warehouse):</h4>
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <p className="font-bold text-xl text-blue-700 mb-1">
                  {getWarehouseName()}
                </p>
                {getWarehouseFullAddress() && (
                  <p className="text-gray-600 mb-1">📍 {getWarehouseFullAddress()}</p>
                )}
                {getWarehousePhone() && (
                  <p className="text-gray-600 mb-1">📞 {getWarehousePhone()}</p>
                )}
                {getWarehouseEmail() && (
                  <p className="text-gray-600">✉️ {getWarehouseEmail()}</p>
                )}
                {getWarehouseName() === "Warehouse" && !getWarehouseFullAddress() && !getWarehousePhone() && (
                  <p className="text-gray-500 italic">Warehouse details not available</p>
                )}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-600 mb-2">To (Customer):</h4>
              <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                <p className="font-bold text-xl text-green-700 mb-1">
                  {customerName || "Walk-in"}
                </p>
                {customerAddress && (
                  <p className="text-gray-600 mb-1">📍 {customerAddress}</p>
                )}
                {customerPhone && (
                  <p className="text-gray-600">📞 {customerPhone}</p>
                )}
                {!customerAddress && !customerPhone && (
                  <p className="text-gray-500 italic"></p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-6 p-4 bg-gray-50 rounded-lg">
            <p><strong>Invoice No:</strong> {invoiceNumber}</p>
            <p><strong>Date:</strong> {formatLocalToManila(transactionDate) || "--"}</p>
            <p><strong>Payment Method:</strong> {paymentMethod ? paymentMethod.toUpperCase() : "--"}</p>
            <p><strong>Handled By:</strong> {handledBy || "--"}</p>
          </div>
          
          {mspNo && (
            <div className="mt-2 p-2 bg-yellow-50 rounded border-l-4 border-yellow-500">
              <strong>MSP Reference No:</strong> {mspNo}
            </div>
          )}
          
          <div className="mt-2">
            <strong>Transaction Type:</strong> 
            <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
              isVanLoad ? 'bg-purple-100 text-purple-700' : 
              isWarehouse ? 'bg-blue-100 text-blue-700' : 
              'bg-gray-100 text-gray-700'
            }`}>
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
          <p className="text-right font-semibold mt-1">
            SUBTOTAL: ₱{fmt(emptiesPriceTotal)}
          </p>
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