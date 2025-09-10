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
    miscItems, // optional top-level
  } = payload || {};

  const width = options.width || "58mm";          // "58mm" | "80mm"
  const cols = options.cols || (width === "80mm" ? 48 : 42);

  // Try to find misc items if not passed at top-level
  const expensesList =
    miscItems ||
    options.miscItems ||
    (tables?.products?.[0]?.expenses && Array.isArray(tables.products[0].expenses)
      ? tables.products[0].expenses
      : []);

  /* ---------- helpers ---------- */
  const n = (v) => Number(v || 0);
  const peso = (v) =>
    `₱${(n(v)).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const line = (ch = "-") => ch.repeat(cols);
  const clip = (s = "", len = cols) =>
    String(s).normalize("NFKD").replace(/[^\x00-\x7F]/g, "").slice(0, len);
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
  const storeAddr = warehouse?.fullAddress || "";
  const storePhone = warehouse?.phone || "";

  const headerBlock = [
    clip(storeName.toUpperCase(), cols),
    storeAddr ? clip(storeAddr, cols) : "",
    storePhone ? clip(`Tel: ${storePhone}`, cols) : "",
    line()
  ].filter(Boolean).join("\n");

  /* ---------- meta ---------- */
  const metaBlock = [
    mspNo ? lr(`MSP: ${mspNo}`, `INV: ${invoiceNumber}`) : lr(`INV: ${invoiceNumber}`, ""),
    lr(`Cashier: ${handledBy || "-"}`, (transactionTypeName || "Standard").toUpperCase()),
    lr("Date:", dt),
    customer?.name ? lr("Customer:", clip(customer.name, cols - 11)) : "",
    line()
  ].filter(Boolean).join("\n");

  /* ---------- items (sold products) ---------- */
  const products = Array.isArray(tables?.products) ? tables.products : [];
  const itemsBlock = products.map((r) => {
    const name = clip(r.product || "--", cols);
    const amount = peso(r.amount);
    const l1 = lr(name, amount);

    const pcs = n(r.soldPcs);
    const shells = n(r.soldShell);
    const unit = peso(r.unitPrice);
    const l2 = lr(`${pcs} pcs @ ${unit}`, shells ? `Shells: ${shells}` : "");

    const discPct = n(r.discountPercent);
    const l3 = discPct ? lr("", `Less: ${discPct}%`) : "";

    return [l1, l2, l3].filter(Boolean).join("\n");
  }).join("\n");

  /* ---------- totals ---------- */
  const {
    actualSales,
    emptiesPriceTotal,
    emptyReturns,
    emptyDiscrepancies,
    totalAmount,
    cashReceived,
    change,
    amountDue,
    isVanLoad,
    // isWarehouse,
    vl_discNE,
    vl_retWc,
    expensesTotal,
    vl_overallTotal,
    vl_grandTotal,
  } = totals;

  const commonTotals = [
    line(),
    lr("Subtotal", peso(actualSales)),
    lr("Empties Price", peso(emptiesPriceTotal)),
    lr("Empty Returns", `- ${peso(emptyReturns)}`),
    lr("Discrepancies (Empty)", peso(emptyDiscrepancies)),
  ];

  const totalsBlock = isVanLoad
    ? [
        ...commonTotals,
        lr("Discrepancies (Non-Empty)", peso(vl_discNE)),
        lr("Returned w/ Content",      peso(vl_retWc)),
        lr("Expenses",                 `- ${peso(expensesTotal)}`),
        line(),
        lr("Overall Total",            peso(vl_overallTotal)),
        lr("Grand Total",              peso(vl_grandTotal)),
      ].join("\n")
    : [
        ...commonTotals,
        line(),
        lr("Total Amount Due", peso(totalAmount)),
      ].join("\n");

  /* ---------- expenses (optional) ---------- */
  const expensesBlock = expensesList && expensesList.length
    ? [
        "EXPENSES",
        line(),
        ...expensesList.map(e => lr(clip(e.description, cols - 12), peso(Number(e.amount || 0)))),
        lr("Total Expenses", peso(expensesList.reduce((s, i) => s + Number(i.amount || 0), 0))),
        line()
      ].join("\n")
    : "";

  /* ---------- payment ---------- */
  const paymentBlock = [
    lr("Payment Method", (paymentMethod || "-").toString().toUpperCase()),
    lr("Amount Due",     peso(n(amountDue) || n(totalAmount))),
    lr("Cash Received",  peso(cashReceived)),
    lr("Change",         peso(change)),
    line()
  ].join("\n");

  /* ---------- footer ---------- */
  const footerBlock = [
    "Thank you for your business!",
    "Keep this receipt for your records.",
    ""
  ].join("\n");

  /* ---------- compose text ---------- */
  const text = [
    headerBlock,
    metaBlock,
    itemsBlock,
    totalsBlock,
    expensesBlock,
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
      white-space: pre; /* preserve spaces/newlines for monospace layout */
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

  // Guard for non-browser environments
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // --- Try popup window first ---
  let win = null;
  try {
    win = window.open("", "_blank", "width=480,height=800,noopener,noreferrer");
  } catch (_) {
    // ignored
  }

  if (win && win.document) {
    // Success: write and print from popup
    win.document.open();
    win.document.write(html);
    win.document.close();

    const finalize = () => {
      try { win.focus(); } catch (_) {}
      try { win.print(); } catch (_) {}
      try { win.close(); } catch (_) {}
    };

    // Give the browser a tick to lay out
    if ("onload" in win) {
      win.onload = finalize;
    } else {
      setTimeout(finalize, 250);
    }
    return;
  }

  // --- Fallback: hidden iframe (works even if popups are blocked) ---
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

  const cleanup = () => {
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch (_) {}
    }, 500);
  };

  const doPrint = () => {
    try { (iframe.contentWindow || iframe).focus(); } catch (_) {}
    try { (iframe.contentWindow || iframe).print(); } catch (_) {}
    cleanup();
  };

  // onload can be flaky after document.write — add a safety timeout too
  iframe.onload = doPrint;
  setTimeout(doPrint, 300);
};