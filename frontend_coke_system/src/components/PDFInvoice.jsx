// src/pdf/PDFInvoice.jsx
// Public API:
//   await downloadInvoicePDF(payload)

import DejaVuSansTTF from "../components/fonts/dejavu-sans/DejaVuSans.ttf";
import DejaVuSansBoldTTF from "../components/fonts/dejavu-sans/DejaVuSans-Bold.ttf";

// ---------------- font + lib helpers ----------------
const ensureScript = (src) =>
  new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

async function ensurePdfLibs() {
  if (!(window.jspdf && window.jspdf.jsPDF)) {
    await ensureScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  }
  if (!window.jspdf.jsPDF.API.autoTable) {
    await ensureScript(
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"
    );
  }
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function ensurePesoFont(doc) {
  if (window.__pesoFontLoaded) return;

  const [bufNormal, bufBold] = await Promise.all([
    fetch(DejaVuSansTTF).then((r) => r.arrayBuffer()),
    fetch(DejaVuSansBoldTTF).then((r) => r.arrayBuffer()),
  ]);

  const base64N = arrayBufferToBase64(bufNormal);
  const base64B = arrayBufferToBase64(bufBold);

  doc.addFileToVFS("DejaVuSans.ttf", base64N);
  doc.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", base64B);
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVuSans", "bold");

  window.__pesoFontLoaded = true;
}

// ---------------- small utils ----------------
const n = (v) => Number(v || 0);
const fmt = (v) => n(v).toFixed(2);
const peso = (v) =>
  `₱${n(v).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

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

/**
 * payload = {
 *   invoiceNumber, paymentMethod, transactionDate, handledBy, mspNo,
 *   transactionTypeName, remarks,
 *   customer: { name, address, phone },
 *   warehouse: { name, fullAddress, phone, email },
 *   totals: {
 *     actualSales, emptiesPriceTotal, emptyReturns, emptyDiscrepancies,
 *     expensesTotal, totalAmount, cashReceived, change, amountDue,
 *     isVanLoad, isWarehouse,
 *     expectedSale, vl_actual, vl_retWc, vl_discNE, vl_discE,
 *     vl_totalActualRetrieved, vl_overallTotal, vl_grandTotal
 *   },
 *   tables: {
 *     products: [{ product, dispatchedShell, dispatchedPcs, soldShell, soldPcs, unitPrice, discountPercent, amount }],
 *     empties:  [{ product, shellPrice, bottlePrice, totalShells, totalPieces, amount }],
 *     returns:  [{ product, shellPrice, bottlePrice, returnedShells, returnedPieces, amount }]
 *   }
 * }
 */

// --- sizes & helpers --------------------------------------------------------
const INCH = 25.4; // mm per inch
const mm = (inches) => inches * INCH;

const BOND_FORMATS = {
  // aliases -> [w, h] in mm (portrait base)
  letter: [mm(8.5), mm(11)],         // Short bond (US Letter)
  short:  [mm(8.5), mm(11)],
  a4:     [210, 297],
  legal:  [mm(8.5), mm(14)],
  long:   [mm(8.5), mm(13)],         // PH Long bond / F4 (8.5" × 13")
  f4:     [mm(8.5), mm(13)],
};

function resolveFormat(paper = "a4", orientation = "portrait") {
  const key = String(paper || "a4").toLowerCase();
  // jsPDF accepts string keywords for a4/letter/legal; use arrays for others
  if (key === "a4" || key === "letter" || key === "legal") {
    return { format: key, orientation };
  }
  const base = BOND_FORMATS[key] || BOND_FORMATS.a4;
  const [w, h] = base;
  const fmt = orientation === "landscape" ? [h, w] : [w, h];
  return { format: fmt, orientation };
}

function pctWidth(pageW, margins, pct) {
  const inner = pageW - (margins.left + margins.right);
  return inner * pct;
}

/**
 * New signature:
 *   await downloadInvoicePDF(payload, {
 *     paper: 'long' | 'short' | 'a4' | 'letter' | 'legal' | 'f4',
 *     orientation: 'portrait' | 'landscape',
 *     margins: { top:12, right:12, bottom:12, left:12 }
 *   })
 */
export async function downloadInvoicePDF(payload, opts = {}) {
  await ensurePdfLibs();
  const { paper = "a4", orientation = "portrait", margins } = opts;

  // margins (mm)
  const M = {
    top:    margins?.top    ?? 12,
    right:  margins?.right  ?? 12,
    bottom: margins?.bottom ?? 12,
    left:   margins?.left   ?? 12,
  };

  // Create jsPDF with chosen paper/orientation
  const { jsPDF } = window.jspdf;
  const { format, orientation: ori } = resolveFormat(paper, orientation);
  const doc = new jsPDF({ unit: "mm", format, orientation: ori });

  // Ensure Unicode font with ₱
  await ensurePesoFont(doc);
  doc.setFont("DejaVuSans", "normal");

  const {
    invoiceNumber, paymentMethod, transactionDate, handledBy, mspNo,
    transactionTypeName, remarks, customer, warehouse, totals, tables,
  } = payload;

  // Page geometry
  const pageW = doc.internal.pageSize.getWidth();
  const innerLeft = M.left;
  const innerRight = pageW - M.right;
  //let y = M.top - 2;

  const txt = (s, x, yy, opts = {}) => doc.text(String(s ?? ""), x, yy, opts);

  // ---- Header bar ----------------------------------------------------------
  const headerH = 30; // a bit taller to fit two lines
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageW, headerH, "F");

  doc.setFont("DejaVuSans", "bold");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  txt("INVOICE", innerLeft, 12); // title

  doc.setFont("DejaVuSans", "normal");
  doc.setFontSize(10);

  // two rows, two columns
  const row1Y = 18;
  const row2Y = 24;

  txt(`Invoice No: ${invoiceNumber || "--"}`, innerLeft, row1Y);
  txt(`Date: ${formatLocalToManila(transactionDate)}`, innerRight, row1Y, { align: "right" });

  txt(`Payment: ${paymentMethod ? String(paymentMethod).toUpperCase() : "--"}`, innerLeft, row2Y);
  txt(`Handled By: ${handledBy || "--"}`, innerRight, row2Y, { align: "right" });

  // status badge (kept)
  const badgeTxt = paymentMethod === "credit" ? "CREDIT" : "PAID";
  const badgeColor = paymentMethod === "credit" ? [234, 179, 8] : [16, 185, 129];
  const badgeW = 28, badgeH = 8, badgeX = innerRight - badgeW, badgeY = 6;
  doc.setFillColor(...badgeColor);
  doc.rect(badgeX, badgeY, badgeW, badgeH, "F");
  doc.setFont("DejaVuSans", "bold");
  doc.setFontSize(9);
  txt(badgeTxt, badgeX + badgeW / 2, badgeY + 5.5, { align: "center", baseline: "middle" });

  doc.setTextColor(0, 0, 0);
  let y = headerH + 6; // continue layout below header


  // ---- From / To boxes -----------------------------------------------------
  const infoBoxW = (pageW - (M.left + M.right) - 4) / 2;
  const drawInfoBox = (x, y0, w, title, name, lines, bg) => {
    const pad = 4;
    doc.setFillColor(...bg);
    doc.rect(x, y0, w, 26, "F");
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.6);
    doc.line(x, y0, x, y0 + 26);
    doc.setLineWidth(0.2);

    doc.setFont("DejaVuSans", "bold"); doc.setFontSize(9);
    txt(title, x + pad, y0 + 6);

    doc.setFont("DejaVuSans", "normal"); doc.setFontSize(12);
    txt(name || "", x + pad, y0 + 12);

    doc.setFontSize(9); doc.setTextColor(60);
    let yy = y0 + 17;
    (lines || []).filter(Boolean).forEach((l) => {
      const wrapped = doc.splitTextToSize(l, w - pad * 2);
      txt(wrapped, x + pad, yy);
      yy += wrapped.length * 4;
    });
    doc.setTextColor(0, 0, 0);
    return y0 + 26;
  };

  const fromLines = [
    warehouse.fullAddress ? `📍 ${warehouse.fullAddress}` : "",
    warehouse.phone ? `📞 ${warehouse.phone}` : "",
    warehouse.email ? `✉️ ${warehouse.email}` : "",
  ];
  const toLines = [
    customer.address ? `📍 ${customer.address}` : "",
    customer.phone ? `📞 ${customer.phone}` : "",
  ];

  y = drawInfoBox(innerLeft, y, infoBoxW, "From (Source Warehouse):", warehouse.name || "Warehouse", fromLines, [239, 246, 255]);
  drawInfoBox(innerLeft + infoBoxW + 4, 32, infoBoxW, "To (Customer):", customer.name || "Walk-in", toLines, [240, 253, 244]);
  y = Math.max(y, 58) + 4;

  // ---- Meta row ------------------------------------------------------------
  // doc.setFillColor(249, 250, 251);
  // doc.rect(innerLeft, y, pageW - (M.left + M.right), 12, "F");
  // doc.setFontSize(9);
  // const metaY = y + 4.5;
  // txt(`Invoice No: ${invoiceNumber}`, innerLeft + 2, metaY);
  // txt(`Date: ${formatLocalToManila(transactionDate)}`, innerLeft + 70, metaY);
  // txt(`Method: ${paymentMethod ? String(paymentMethod).toUpperCase() : "--"}`, innerLeft + 120, metaY);
  // txt(`Handled By: ${handledBy || "--"}`, innerLeft + 160, metaY);
  y += 16;

  // MSP chip
  if (mspNo) {
    doc.setFillColor(254, 243, 199);
    doc.rect(innerLeft, y, pageW - (M.left + M.right), 8, "F");
    doc.setFontSize(9);
    txt(`MSP Reference No: ${mspNo}`, innerLeft + 2, y + 5.5);
    y += 12;
  }

  // Type chip
  if (transactionTypeName) {
    const isVan = /van\s*load/i.test(String(transactionTypeName));
    const chip = isVan ? { bg: [243, 232, 255], fg: [109, 40, 217] } : { bg: [219, 234, 254], fg: [29, 78, 216] };
    doc.setFillColor(...chip.bg);
    doc.rect(innerLeft, y, 40, 6, "F");
    doc.setTextColor(...chip.fg);
    doc.setFontSize(8);
    doc.setFont("DejaVuSans", "bold");
    txt(String(transactionTypeName), innerLeft + 2, y + 4.2);
    doc.setTextColor(0, 0, 0);
    doc.setFont("DejaVuSans", "normal");
    y += 10;
  }

  // ---- SOLD PRODUCTS -------------------------------------------------------
  doc.setFont("DejaVuSans", "bold"); doc.setFontSize(12); doc.setTextColor(55, 65, 81);
  txt("SOLD PRODUCTS", innerLeft, y); y += 4;

  // adaptive column widths (percent of inner width)
  const cwProducts = {
    0: { cellWidth: pctWidth(pageW, M, 0.34) }, // Product
    1: { cellWidth: pctWidth(pageW, M, 0.15) }, // Dispatched
    2: { cellWidth: pctWidth(pageW, M, 0.15) }, // Sold
    3: { cellWidth: pctWidth(pageW, M, 0.12), halign: "right" }, // Unit Price
    4: { cellWidth: pctWidth(pageW, M, 0.12), halign: "right" }, // Discount
    5: { cellWidth: pctWidth(pageW, M, 0.12), halign: "right" }, // Amount
  };

  doc.autoTable({
    startY: y,
    head: [["Product", "Dispatched", "Sold", "Unit Price", "Discount (%)", "Amount"]],
    body: (tables.products || []).map((r) => [
      (r.product || "").slice(0, 40),
      `${n(r.dispatchedShell)}s (${n(r.dispatchedPcs)}p)`,
      `${n(r.soldShell)}s (${n(r.soldPcs)}p)`,
      peso(r.unitPrice),
      fmt(r.discountPercent),
      peso(r.amount),
    ]),
    margin: { left: M.left, right: M.right },
    styles: { font: "DejaVuSans", fontSize: 9, cellPadding: 2, lineColor: [209, 213, 219], lineWidth: 0.2 },
    headStyles: { font: "DejaVuSans", fontStyle: "bold", fillColor: [243, 244, 246], textColor: [0, 0, 0] },
    columnStyles: cwProducts,
  });
  y = (doc.lastAutoTable?.finalY || y) + 6;
  doc.setFontSize(10); doc.setFont("DejaVuSans", "bold");
  txt(`SUBTOTAL: ${peso(totals.actualSales)}`, innerRight, y, { align: "right" });
  y += 6;

  // ---- EMPTY PRICE ---------------------------------------------------------
  doc.setFont("DejaVuSans", "bold"); doc.setFontSize(12); doc.setTextColor(55, 65, 81);
  txt("EMPTY PRICE", innerLeft, y); y += 4;

  const cwEmpties = {
    0: { cellWidth: pctWidth(pageW, M, 0.30) },           // Product
    1: { cellWidth: pctWidth(pageW, M, 0.14), halign: "right" }, // Shell Price
    2: { cellWidth: pctWidth(pageW, M, 0.14), halign: "right" }, // Bottle Price
    3: { cellWidth: pctWidth(pageW, M, 0.14), halign: "right" }, // Total Shells
    4: { cellWidth: pctWidth(pageW, M, 0.14), halign: "right" }, // Total Pieces
    5: { cellWidth: pctWidth(pageW, M, 0.14), halign: "right" }, // Amount
  };

  doc.autoTable({
    startY: y,
    head: [["Product", "Shell Price", "Bottle Price", "Total Shells", "Total Pieces", "Amount"]],
    body: (tables.empties || []).map((r) => [
      (r.product || "").slice(0, 40),
      peso(r.shellPrice),
      peso(r.bottlePrice),
      n(r.totalShells),
      n(r.totalPieces),
      peso(r.amount),
    ]),
    margin: { left: M.left, right: M.right },
    styles: { font: "DejaVuSans", fontSize: 9, cellPadding: 2, lineColor: [209, 213, 219], lineWidth: 0.2 },
    headStyles: { font: "DejaVuSans", fontStyle: "bold", fillColor: [243, 244, 246], textColor: [0, 0, 0] },
    columnStyles: cwEmpties,
  });
  y = (doc.lastAutoTable?.finalY || y) + 6;
  doc.setFontSize(10); doc.setFont("DejaVuSans", "bold");
  txt(`SUBTOTAL: ${peso(totals.emptiesPriceTotal)}`, innerRight, y, { align: "right" });
  y += 6;

  // ---- RETURNS -------------------------------------------------------------
  doc.setFont("DejaVuSans", "bold"); doc.setFontSize(12); doc.setTextColor(55, 65, 81);
  txt("RETURNS", innerLeft, y); y += 4;

  doc.autoTable({
    startY: y,
    head: [["Product", "Shell Price", "Bottle Price", "Returned Shells", "Returned Pieces", "Amount"]],
    body: (tables.returns || []).map((r) => [
      (r.product || "").slice(0, 40),
      peso(r.shellPrice),
      peso(r.bottlePrice),
      n(r.returnedShells),
      n(r.returnedPieces),
      peso(r.amount),
    ]),
    margin: { left: M.left, right: M.right },
    styles: { font: "DejaVuSans", fontSize: 9, cellPadding: 2, lineColor: [209, 213, 219], lineWidth: 0.2 },
    headStyles: { font: "DejaVuSans", fontStyle: "bold", fillColor: [243, 244, 246], textColor: [0, 0, 0] },
    columnStyles: cwEmpties,
  });
  y = (doc.lastAutoTable?.finalY || y) + 8;

  // ---- PAYMENT BREAKDOWN ---------------------------------------------------
  const breakdownX = M.left;
  const breakdownW = pageW - (M.left + M.right);
  const line = (label, value, opts = {}) => {
    const leftX = breakdownX + 4;
    const rightX = breakdownX + breakdownW - 4;
    doc.setFont("DejaVuSans", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size || 10);
    doc.text(label, leftX, y);
    doc.text(value, rightX, y, { align: "right" });
    y += opts.gap || 6;
  };

  doc.setFontSize(12); doc.setFont("DejaVuSans", "bold");
  txt("PAYMENT BREAKDOWN", breakdownX, y); y += 8;
  const boxTop = y - 6;

  if (totals.isVanLoad) {
    line("Expected Sale", peso(totals.expectedSale), { bold: true, size: 11, gap: 7 });
    doc.setFont("DejaVuSans", "bold"); doc.setFontSize(10);
    txt("Total Actual Retrieved:", breakdownX + 4, y); y += 6;
    line("Actual Sale:", peso(totals.vl_actual));
    line("Returned With Content:", `+ ${peso(totals.vl_retWc)}`);
    line("Discrepancies (non-empty):", `+ ${peso(totals.vl_discNE)}`);
    line("Total:", peso(totals.vl_totalActualRetrieved), { bold: true });

    y += 2; doc.setFont("DejaVuSans", "bold"); doc.setFontSize(10);
    txt("Overall Total:", breakdownX + 4, y); y += 6;
    line("Actual Sale:", peso(totals.vl_actual));
    line("Discrepancies (empty):", `+ ${peso(totals.vl_discE)}`);
    line("Discrepancies (non-empty):", `+ ${peso(totals.vl_discNE)}`);
    line("Total:", peso(totals.vl_overallTotal), { bold: true });
    line("Expenses:", `- ${peso(totals.expensesTotal)}`);
    line("Grand Total:", peso(totals.vl_grandTotal), { bold: true, size: 11, gap: 8 });
  } else {
    line("Actual Sales:", peso(totals.actualSales), { bold: true });
    doc.setFont("DejaVuSans", "bold"); doc.setFontSize(10);
    txt("Discrepancy:", breakdownX + 4, y); y += 6;
    line("Empties Price Total:", peso(totals.emptiesPriceTotal));
    line("Empty Returns:", `- ${peso(totals.emptyReturns)}`);
    line("Total:", peso(totals.emptyDiscrepancies), { bold: true });
    line("Actual Sales", `+ ${peso(totals.actualSales)}`);
    line("Total Amount Due:", peso(totals.totalAmount), { bold: true, size: 11, gap: 8 });
  }

  line("Cash Received:", peso(totals.cashReceived));
  line("Change:", peso(totals.change));

  const boxBottom = y + 2;
  doc.setDrawColor(0); doc.setLineWidth(0.3);
  doc.rect(breakdownX, boxTop, breakdownW, boxBottom - boxTop);

  if (totals.isVanLoad && remarks) {
    y = boxBottom + 4;
    doc.setFont("DejaVuSans", "bold"); doc.setFontSize(10);
    txt("Remarks:", M.left, y);
    doc.setFont("DejaVuSans", "normal"); y += 5;
    const wrapped = doc.splitTextToSize(remarks, pageW - (M.left + M.right));
    txt(wrapped, M.left, y);
  }

  doc.save(`Invoice_${invoiceNumber}.pdf`);
}
