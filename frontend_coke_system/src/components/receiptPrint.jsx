// src/utils/receiptPrint.jsx
/* Thermal receipt generator + printer (58mm/80mm)
 * Expected payload = what your buildInvoicePdfPayload() returns:
 * {
 *   invoiceNumber, paymentMethod, transactionDate, handledBy, mspNo, transactionTypeName,
 *   customer: { name, address, phone },
 *   warehouse: { name, fullAddress, phone, email },
 *   totals: {
 *     actualSales, emptiesPriceTotal, emptyReturns, emptyDiscrepancies,
 *     totalAmount, cashReceived, change, amountDue,
 *     isVanLoad, isWarehouse,
 *     expectedSale, vl_discNE, vl_retWc, expensesTotal,
 *     vl_overallTotal, vl_grandTotal
 *   },
 *   tables: {
 *     products: [{ product, dispatchedShell, dispatchedPcs, soldShell, soldPcs, unitPrice, discountPercent, amount }],
 *     // optionally returns/empties, not strictly needed for this print
 *   },
 *   // optional misc items: miscItems: [{description, amount}]
 * }
 */

export const generateReceiptHTML = (payload, options = {}) => {
  const {
    invoiceNumber,
    paymentMethod,
    transactionDate,
    handledBy,
    mspNo,
    transactionTypeName,
    customer = {},
    warehouse = {},
    totals = {},
    tables = {},
  } = payload || {};

  const width = options.width || "58mm";          // "58mm" | "80mm"
  const cols = options.cols || (width === "80mm" ? 48 : 42);

  /* ---------- helpers ---------- */
  const n = (v) => Number(v || 0);
  const peso = (v) =>
    `${n(v).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const line = (ch = "-") => ch.repeat(cols);
  const dblLine = (ch = "=") => ch.repeat(cols);
  const clip = (s = "", len = cols) =>
    String(s).normalize("NFKD").replace(/[^\x00-\x7F]/g, "").slice(0, len);
  const wrapText = (text = "", maxLen = cols) => {
    if (!text) return [];
    const normalized = String(text).normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
    const words = normalized.split(" ");
    const lines = [];
    let currentLine = "";
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length <= maxLen) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word.length <= maxLen ? word : word.slice(0, maxLen);
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  };
  const lr = (left, right) => {
    const L = clip(left, cols);
    const R = clip(right, cols);
    const space = Math.max(1, cols - L.length - R.length);
    return `${L}${" ".repeat(space)}${R}`;
  };
  const formatManila = (isoOrStr) => {
    if (!isoOrStr) return "--";
    const d = new Date(isoOrStr);
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: true,
    }).format(d);
  };

  const dt = formatManila(transactionDate);

  /* ---------- header ---------- */
  const storeName = warehouse?.name || "Warehouse";
  
  // Ensure address and phone are always displayed from any available source
  let storeAddr = warehouse?.fullAddress || "";
  let storePhone = warehouse?.phone || "";
  
  // If warehouse data is missing, try to get from payload data (invoiceData fields that might be passed)
  const payloadData = payload || {};
  if (!storeAddr) {
    // Try to construct address from individual fields
    const addrParts = [];
    if (payloadData.warehouse_address) addrParts.push(payloadData.warehouse_address);
    if (payloadData.warehouse_city) addrParts.push(payloadData.warehouse_city);
    if (payloadData.warehouse_region) addrParts.push(payloadData.warehouse_region);
    if (addrParts.length > 0) {
      storeAddr = addrParts.join(", ");
    } else {
      storeAddr = payloadData.warehouse_full_address || "";
    }
  }
  
  if (!storePhone) {
    storePhone = payloadData.warehouse_phone || "";
  }

  const headerLines = [clip(storeName.toUpperCase(), cols)];
  
  // Add wrapped address lines
  if (storeAddr) {
    const addressLines = wrapText(storeAddr, cols);
    headerLines.push(...addressLines);
  }
  
  // Add phone line
  if (storePhone) {
    headerLines.push(clip(`Tel: ${storePhone}`, cols));
  }
  
  headerLines.push(line());
  
  const headerBlock = headerLines.join("\n");

  /* ---------- meta ---------- */
  const metaBlock = [
    mspNo ? lr(`MSP: ${mspNo}`, `INV: ${invoiceNumber}`) : lr(`INV: ${invoiceNumber}`, ""),
    lr(`Cashier: ${handledBy || "-"}`, (transactionTypeName || "Standard").toUpperCase()),
    lr("Date:", dt),
    customer?.name ? lr("Customer:", clip(customer.name, cols - 11)) : "",
    line()
  ].filter(Boolean).join("\n");

  /* ---------- SOLD PRODUCTS ---------- */
  const products = Array.isArray(tables?.products) ? tables.products : [];
  const itemsBlock = products.length
    ? [
        "SOLD PRODUCTS",
        line(),
        ...products.map((r) => {
          const name = clip(r.product || "--", cols);
          const l1 = lr(name, peso(r.amount));
          const pcs = n(r.soldPcs);
          const shells = n(r.soldShell);
          const unit = peso(r.unitPrice);
          const l2 = lr(`${pcs} pcs @ ₱${unit}`, shells ? `${shells} shells` : "");
          return [l1, l2].join("\n");
        }),
        lr("SOLD TOTAL", peso(totals.actualSales)),
      ].join("\n")
    : "";

  /* ---------- EMPTY PRICE ---------- */
  const emptiesRows = Array.isArray(tables?.empties) ? tables.empties : [];
  const emptiesBlock = emptiesRows.length
    ? [
        "EMPTY PRICE",
        line(),
        ...emptiesRows.map((e) => {
          const name = clip(e.product || "--", cols);
          const l1 = lr(name, peso(e.amount));
          const l2 = lr(
            `₱${peso(e.shellPrice)} x ${n(e.totalShells)}`,
            `₱${peso(e.bottlePrice)} x ${n(e.totalPieces)}`
          );
          return [l1, l2].join("\n");
        }),
        lr("EMPTIES TOTAL", peso(totals.emptiesPriceTotal)),
      ].join("\n")
    : "";

  /* ---------- RETURNS ---------- */
  const returnsRows = Array.isArray(tables?.returns) ? tables.returns : [];
  const returnsBlock = returnsRows.length
    ? [
        "RETURNS",
        line(),
        ...returnsRows.map((r) => {
          const name = clip(r.product || "--", cols);
          const l1 = lr(name, peso(r.amount));
          const l2 = lr(
            `₱${peso(r.shellPrice)} x ${n(r.returnedShells)}`,
            `₱${peso(r.bottlePrice)} x ${n(r.returnedPieces)}`
          );
          return [l1, l2].join("\n");
        }),
        lr("RETURNS TOTAL", `-${peso(totals.emptyReturns)}`),
      ].join("\n")
    : "";

  /* ---------- GRAND TOTAL ---------- */
  const totalAmountVal  = n(totals.totalAmount);
  const amountDueVal    = n(totals.amountDue) || totalAmountVal;
  const cashReceivedVal = n(totals.cashReceived) || amountDueVal;
  const changeVal       = n(totals.change) || (cashReceivedVal - amountDueVal);

  const totalsBlock = [
    dblLine(),
    lr("TOTAL AMOUNT DUE", peso(totalAmountVal)),
    dblLine(),
  ].join("\n");

  /* ---------- payment ---------- */
  const paymentBlock = [
    lr("Payment Method", (paymentMethod || "-").toString().toUpperCase()),
    lr("Amount Due", peso(amountDueVal)),
    lr("Cash Received", peso(cashReceivedVal)),
    lr("Change", peso(changeVal)),
    line(),
  ].join("\n");

  /* ---------- footer ---------- */
  const footerBlock = [
    line(),
    "THANK YOU FOR YOUR BUSINESS!".padStart(Math.floor((cols + 29) / 2)),
    "Keep this receipt for your records.".padStart(Math.floor((cols + 35) / 2)),
    "",
  ].join("\n");

  /* ---------- compose text ---------- */
  const text = [
    headerBlock,
    metaBlock,
    itemsBlock,
    emptiesBlock,
    returnsBlock,
    totalsBlock,
    paymentBlock,
    footerBlock
  ].filter(Boolean).join("\n");

  /* ---------- printable HTML ---------- */
  const safeText = text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${invoiceNumber || ""}</title>
  <style>
    @page { size: ${width} auto; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body {
      width: ${width};
      font-family: "Courier New", monospace;
      font-size: 11px;
      line-height: 1.2;
      color: #000;
    }
    .wrap {
      padding: 6mm 3mm;
      white-space: pre;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="wrap">${safeText}</div>
</body>
</html>`;
};

export const printReceipt = (payload, options = {}) => {
  const html = generateReceiptHTML(payload, options);

  if (typeof window === "undefined" || typeof document === "undefined") return;

  // Use a hidden iframe so printing does not open a second app window.

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const idoc = iframe.contentWindow?.document || iframe.contentDocument;
  idoc.open();
  idoc.write(html);
  idoc.close();

  let didPrint = false;

  const cleanup = () => {
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch (_) {}
    }, 500);
  };

  const doPrint = () => {
    if (didPrint) return;
    didPrint = true;
    try { (iframe.contentWindow || iframe).focus(); } catch (_) {}
    try { (iframe.contentWindow || iframe).print(); } catch (_) {}
    cleanup();
  };

  iframe.onload = doPrint;
  setTimeout(doPrint, 300);
};
