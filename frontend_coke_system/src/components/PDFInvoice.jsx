// src/components/PDFInvoice.jsx
// Public API:
//   await downloadInvoicePDF(payload, { paper, orientation, margins })

import DejaVuSansTTF from "../components/fonts/dejavu-sans/DejaVuSans.ttf";
import DejaVuSansBoldTTF from "../components/fonts/dejavu-sans/DejaVuSans-Bold.ttf";

const ensureScript = (src) =>
  new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
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
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

async function ensurePesoFont(doc) {
  if (window.__pesoFontLoaded) return;

  const [normalBuffer, boldBuffer] = await Promise.all([
    fetch(DejaVuSansTTF).then((response) => response.arrayBuffer()),
    fetch(DejaVuSansBoldTTF).then((response) => response.arrayBuffer()),
  ]);

  doc.addFileToVFS("DejaVuSans.ttf", arrayBufferToBase64(normalBuffer));
  doc.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", arrayBufferToBase64(boldBuffer));
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVuSans", "bold");

  window.__pesoFontLoaded = true;
}

const PESO_SYMBOL = "₱";
const INCH = 25.4;

const BOND_FORMATS = {
  letter: [8.5 * INCH, 11 * INCH],
  short: [8.5 * INCH, 11 * INCH],
  a4: [210, 297],
  legal: [8.5 * INCH, 14 * INCH],
  long: [8.5 * INCH, 13 * INCH],
  f4: [8.5 * INCH, 13 * INCH],
};

const n = (value) => Number(value || 0);

const fmt = (value, decimals = 2) =>
  n(value).toLocaleString("en-PH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const peso = (value) => `${PESO_SYMBOL}${fmt(value, 2)}`;

const cleanText = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).replace(/\s+/g, " ").trim();
  return normalized || fallback;
};

const hasMeaningfulValue = (...values) =>
  values.some((value) => {
    if (value === null || value === undefined || value === "") return false;
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) return Math.abs(numeric) > 0;
    return cleanText(value) !== "";
  });

const normalizeRows = (rows) => (Array.isArray(rows) ? rows : []);

const formatLocalToManila = (localStr) => {
  if (!localStr) return "--";
  const date = new Date(localStr);
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

function resolveFormat(paper = "a4", orientation = "portrait") {
  const key = String(paper || "a4").toLowerCase();
  if (key === "a4" || key === "letter" || key === "legal") {
    return { format: key, orientation };
  }

  const base = BOND_FORMATS[key] || BOND_FORMATS.a4;
  const [width, height] = base;
  return {
    format: orientation === "landscape" ? [height, width] : [width, height],
    orientation,
  };
}

function buildLayoutConfig(doc, margins) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const innerW = pageW - (margins.left + margins.right);
  const narrow = innerW < 175;
  const compact = innerW < 210;

  return {
    pageW,
    pageH,
    innerW,
    compact,
    narrow,
    stackInfoBoxes: innerW < 215,
    headerH: compact ? 26 : 30,
    titleFontSize: narrow ? 15 : compact ? 16.5 : 18,
    metaFontSize: narrow ? 7.5 : compact ? 8.2 : 9.2,
    sectionTitleSize: narrow ? 10.5 : 12,
    bodyFontSize: narrow ? 7.5 : compact ? 8.2 : 9,
    smallFontSize: narrow ? 7 : compact ? 7.6 : 8.2,
    breakdownFontSize: narrow ? 8 : compact ? 8.6 : 9.5,
    tableFontSize: narrow ? 7 : compact ? 7.6 : 8.5,
    tablePadding: narrow ? 1.4 : compact ? 1.7 : 2.2,
    sectionGap: narrow ? 4.5 : compact ? 5.5 : 6.5,
    boxGap: 4,
    infoLineHeight: narrow ? 3.4 : compact ? 3.8 : 4.3,
  };
}

function createColumnStyles(innerW, specs) {
  return specs.reduce((styles, spec, index) => {
    styles[index] = {
      cellWidth: innerW * spec.pct,
      ...(spec.align ? { halign: spec.align } : {}),
    };
    return styles;
  }, {});
}

export async function downloadInvoicePDF(payload, opts = {}) {
  await ensurePdfLibs();

  const requestedPaper = String(opts.paper || "long").toLowerCase();
  const requestedOrientation = String(opts.orientation || "portrait").toLowerCase();
  const defaultMargin = requestedOrientation === "landscape" || ["short", "letter"].includes(requestedPaper) ? 10 : 12;
  const margins = {
    top: opts.margins?.top ?? defaultMargin,
    right: opts.margins?.right ?? defaultMargin,
    bottom: opts.margins?.bottom ?? defaultMargin,
    left: opts.margins?.left ?? defaultMargin,
  };

  const { jsPDF } = window.jspdf;
  const { format, orientation } = resolveFormat(requestedPaper, requestedOrientation);
  const doc = new jsPDF({ unit: "mm", format, orientation });
  await ensurePesoFont(doc);
  doc.setFont("DejaVuSans", "normal");

  const customer = payload?.customer || {};
  const warehouse = payload?.warehouse || {};
  const totals = payload?.totals || {};
  const tables = payload?.tables || {};
  const remarks = cleanText(payload?.remarks);

  const layout = buildLayoutConfig(doc, margins);
  const innerLeft = margins.left;
  const innerRight = layout.pageW - margins.right;
  const pageBottom = layout.pageH - margins.bottom;
  const text = (value, x, y, options = {}) => doc.text(value ?? "", x, y, options);

  let y = layout.headerH + layout.sectionGap;

  const ensureSpace = (requiredHeight = 12) => {
    if (y + requiredHeight <= pageBottom) return;
    doc.addPage();
    y = margins.top;
  };

  const drawSectionTitle = (title) => {
    ensureSpace(layout.sectionGap + 8);
    doc.setFont("DejaVuSans", "bold");
    doc.setFontSize(layout.sectionTitleSize);
    doc.setTextColor(55, 65, 81);
    text(title, innerLeft, y);
    doc.setTextColor(0, 0, 0);
    y += layout.compact ? 4 : 5;
  };

  const drawSubtotal = (label, value) => {
    ensureSpace(8);
    doc.setFont("DejaVuSans", "bold");
    doc.setFontSize(layout.breakdownFontSize);
    text(`${label}: ${peso(value)}`, innerRight, y, { align: "right" });
    y += layout.sectionGap;
  };

  const drawInfoBox = (x, startY, width, title, name, lines, fillColor) => {
    const pad = layout.narrow ? 3 : 4;
    const usableWidth = width - pad * 2;
    const nameLines = doc.splitTextToSize(cleanText(name, "--"), usableWidth);
    const detailLines = (lines || []).flatMap((line) => doc.splitTextToSize(cleanText(line), usableWidth));
    const minHeight = layout.compact ? 24 : 28;
    const boxHeight = Math.max(
      minHeight,
      pad + 4 + nameLines.length * layout.infoLineHeight + detailLines.length * layout.infoLineHeight + pad
    );

    doc.setFillColor(...fillColor);
    doc.roundedRect(x, startY, width, boxHeight, 2, 2, "F");
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(x, startY, width, boxHeight, 2, 2, "S");

    let lineY = startY + pad + 2.5;
    doc.setFont("DejaVuSans", "bold");
    doc.setFontSize(layout.smallFontSize);
    text(title, x + pad, lineY);

    lineY += layout.infoLineHeight;
    doc.setFont("DejaVuSans", "bold");
    doc.setFontSize(layout.bodyFontSize + 1);
    text(nameLines, x + pad, lineY);
    lineY += nameLines.length * layout.infoLineHeight + 0.5;

    doc.setFont("DejaVuSans", "normal");
    doc.setFontSize(layout.bodyFontSize);
    detailLines.forEach((line) => {
      text(line, x + pad, lineY);
      lineY += layout.infoLineHeight;
    });

    return startY + boxHeight;
  };

  const renderTableSection = ({ title, head, body, columnSpecs, subtotalLabel, subtotalValue }) => {
    if (!body.length) return;

    drawSectionTitle(title);
    doc.autoTable({
      startY: y,
      head: [head],
      body,
      margin: { left: margins.left, right: margins.right },
      theme: "grid",
      styles: {
        font: "DejaVuSans",
        fontSize: layout.tableFontSize,
        cellPadding: layout.tablePadding,
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        overflow: "linebreak",
        textColor: [31, 41, 55],
        valign: "middle",
      },
      headStyles: {
        font: "DejaVuSans",
        fontStyle: "bold",
        fillColor: [241, 245, 249],
        textColor: [17, 24, 39],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: createColumnStyles(layout.innerW, columnSpecs),
      rowPageBreak: "avoid",
    });

    y = (doc.lastAutoTable?.finalY || y) + layout.sectionGap;

    if (subtotalLabel) {
      drawSubtotal(subtotalLabel, subtotalValue);
    }
  };

  const productRows = normalizeRows(tables.products)
    .filter((row) =>
      hasMeaningfulValue(
        row?.product,
        row?.dispatchedShell,
        row?.dispatchedPcs,
        row?.soldShell,
        row?.soldPcs,
        row?.unitPrice,
        row?.discountPercent,
        row?.amount
      )
    )
    .map((row) => [
      cleanText(row?.product, "-"),
      `${n(row?.dispatchedShell)}s / ${n(row?.dispatchedPcs)}p`,
      `${n(row?.soldShell)}s / ${n(row?.soldPcs)}p`,
      peso(row?.unitPrice),
      fmt(row?.discountPercent),
      peso(row?.amount),
    ]);

  const emptyRows = normalizeRows(tables.empties)
    .filter((row) =>
      hasMeaningfulValue(
        row?.product,
        row?.shellPrice,
        row?.bottlePrice,
        row?.totalShells,
        row?.totalPieces,
        row?.amount
      )
    )
    .map((row) => [
      cleanText(row?.product, "-"),
      peso(row?.shellPrice),
      peso(row?.bottlePrice),
      String(n(row?.totalShells)),
      String(n(row?.totalPieces)),
      peso(row?.amount),
    ]);

  const returnRows = normalizeRows(tables.returns)
    .filter((row) =>
      hasMeaningfulValue(
        row?.product,
        row?.shellPrice,
        row?.bottlePrice,
        row?.returnedShells,
        row?.returnedPieces,
        row?.amount
      )
    )
    .map((row) => [
      cleanText(row?.product, "-"),
      peso(row?.shellPrice),
      peso(row?.bottlePrice),
      String(n(row?.returnedShells)),
      String(n(row?.returnedPieces)),
      peso(row?.amount),
    ]);

  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, layout.pageW, layout.headerH, "F");
  doc.setTextColor(255, 255, 255);

  doc.setFont("DejaVuSans", "bold");
  doc.setFontSize(layout.titleFontSize);
  text("INVOICE", innerLeft, layout.compact ? 11 : 12.5);

  const badgeText = String(payload?.paymentMethod || "").toLowerCase() === "credit" ? "CREDIT" : "PAID";
  const badgeColor = badgeText === "CREDIT" ? [234, 179, 8] : [16, 185, 129];
  doc.setFont("DejaVuSans", "bold");
  doc.setFontSize(layout.smallFontSize);
  const badgePaddingX = layout.compact ? 3 : 4;
  const badgeWidth = Math.max(24, doc.getTextWidth(badgeText) + badgePaddingX * 2);
  const badgeHeight = layout.compact ? 6.5 : 8;
  const badgeY = layout.compact ? 4.5 : 5.5;
  const badgeX = innerRight - badgeWidth;
  doc.setFillColor(...badgeColor);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 2, 2, "F");
  text(badgeText, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 1.1, { align: "center" });

  doc.setFont("DejaVuSans", "normal");
  doc.setFontSize(layout.metaFontSize);
  const row1Y = layout.compact ? 17 : 18.5;
  const row2Y = layout.compact ? 21.5 : 24.5;
  text(`Invoice No: ${cleanText(payload?.invoiceNumber, "--")}`, innerLeft, row1Y);
  text(`Date: ${formatLocalToManila(payload?.transactionDate)}`, innerRight, row1Y, { align: "right" });
  text(`Payment: ${cleanText(payload?.paymentMethod, "--").toUpperCase()}`, innerLeft, row2Y);
  text(`Handled By: ${cleanText(payload?.handledBy, "--")}`, innerRight, row2Y, { align: "right" });

  doc.setTextColor(0, 0, 0);

  const fromLines = [
    cleanText(warehouse?.fullAddress) ? `Address: ${cleanText(warehouse?.fullAddress)}` : "",
    cleanText(warehouse?.phone) ? `Phone: ${cleanText(warehouse?.phone)}` : "",
    cleanText(warehouse?.email) ? `Email: ${cleanText(warehouse?.email)}` : "",
  ].filter(Boolean);

  const toLines = [
    cleanText(customer?.address) ? `Address: ${cleanText(customer?.address)}` : "",
    cleanText(customer?.phone) ? `Phone: ${cleanText(customer?.phone)}` : "",
  ].filter(Boolean);

  const infoBoxWidth = layout.stackInfoBoxes ? layout.innerW : (layout.innerW - layout.boxGap) / 2;
  const fromBottom = drawInfoBox(
    innerLeft,
    y,
    infoBoxWidth,
    "From",
    cleanText(warehouse?.name, "Warehouse"),
    fromLines,
    [239, 246, 255]
  );

  const toBottom = layout.stackInfoBoxes
    ? drawInfoBox(
        innerLeft,
        fromBottom + layout.boxGap,
        infoBoxWidth,
        "To",
        cleanText(customer?.name, "Walk-in"),
        toLines,
        [240, 253, 244]
      )
    : drawInfoBox(
        innerLeft + infoBoxWidth + layout.boxGap,
        y,
        infoBoxWidth,
        "To",
        cleanText(customer?.name, "Walk-in"),
        toLines,
        [240, 253, 244]
      );

  y = Math.max(fromBottom, toBottom) + layout.sectionGap;

  if (cleanText(payload?.mspNo)) {
    const chipHeight = layout.compact ? 7 : 8;
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(innerLeft, y, layout.innerW, chipHeight, 2, 2, "F");
    doc.setFont("DejaVuSans", "bold");
    doc.setFontSize(layout.smallFontSize);
    text(`MSP Reference No: ${cleanText(payload?.mspNo)}`, innerLeft + 3, y + chipHeight - 2.1);
    y += chipHeight + layout.sectionGap;
  }

  if (cleanText(payload?.transactionTypeName)) {
    const isVanLoad = /van\s*load/i.test(String(payload.transactionTypeName));
    const chipText = cleanText(payload.transactionTypeName);
    const chipHeight = layout.compact ? 6.5 : 7;
    const chipPadding = layout.compact ? 3 : 4;
    const colors = isVanLoad
      ? { bg: [243, 232, 255], fg: [109, 40, 217] }
      : { bg: [219, 234, 254], fg: [29, 78, 216] };

    doc.setFont("DejaVuSans", "bold");
    doc.setFontSize(layout.smallFontSize);
    const chipWidth = Math.min(layout.innerW, doc.getTextWidth(chipText) + chipPadding * 2);
    doc.setFillColor(...colors.bg);
    doc.roundedRect(innerLeft, y, chipWidth, chipHeight, 2, 2, "F");
    doc.setTextColor(...colors.fg);
    text(chipText, innerLeft + chipPadding, y + chipHeight - 2.0);
    doc.setTextColor(0, 0, 0);
    y += chipHeight + layout.sectionGap;
  }

  renderTableSection({
    title: "SOLD PRODUCTS",
    head: [
      "Product",
      "Dispatched",
      "Sold",
      layout.compact ? "Price" : "Unit Price",
      layout.compact ? "Disc (%)" : "Discount (%)",
      "Amount",
    ],
    body: productRows,
    columnSpecs: layout.compact
      ? [
          { pct: 0.28 },
          { pct: 0.16, align: "center" },
          { pct: 0.16, align: "center" },
          { pct: 0.13, align: "right" },
          { pct: 0.11, align: "right" },
          { pct: 0.16, align: "right" },
        ]
      : [
          { pct: 0.34 },
          { pct: 0.15, align: "center" },
          { pct: 0.15, align: "center" },
          { pct: 0.12, align: "right" },
          { pct: 0.12, align: "right" },
          { pct: 0.12, align: "right" },
        ],
    subtotalLabel: "Subtotal",
    subtotalValue: totals.actualSales,
  });

  renderTableSection({
    title: "EMPTY PRICE",
    head: [
      "Product",
      layout.compact ? "Shell" : "Shell Price",
      layout.compact ? "Bottle" : "Bottle Price",
      layout.compact ? "Shells" : "Total Shells",
      layout.compact ? "Pieces" : "Total Pieces",
      "Amount",
    ],
    body: emptyRows,
    columnSpecs: layout.compact
      ? [
          { pct: 0.24 },
          { pct: 0.13, align: "right" },
          { pct: 0.13, align: "right" },
          { pct: 0.15, align: "right" },
          { pct: 0.15, align: "right" },
          { pct: 0.20, align: "right" },
        ]
      : [
          { pct: 0.30 },
          { pct: 0.14, align: "right" },
          { pct: 0.14, align: "right" },
          { pct: 0.14, align: "right" },
          { pct: 0.14, align: "right" },
          { pct: 0.14, align: "right" },
        ],
    subtotalLabel: "Subtotal",
    subtotalValue: totals.emptiesPriceTotal,
  });

  renderTableSection({
    title: "RETURNS",
    head: [
      "Product",
      layout.compact ? "Shell" : "Shell Price",
      layout.compact ? "Bottle" : "Bottle Price",
      layout.compact ? "Ret. Shells" : "Returned Shells",
      layout.compact ? "Ret. Pieces" : "Returned Pieces",
      "Amount",
    ],
    body: returnRows,
    columnSpecs: layout.compact
      ? [
          { pct: 0.24 },
          { pct: 0.13, align: "right" },
          { pct: 0.13, align: "right" },
          { pct: 0.15, align: "right" },
          { pct: 0.15, align: "right" },
          { pct: 0.20, align: "right" },
        ]
      : [
          { pct: 0.30 },
          { pct: 0.14, align: "right" },
          { pct: 0.14, align: "right" },
          { pct: 0.14, align: "right" },
          { pct: 0.14, align: "right" },
          { pct: 0.14, align: "right" },
        ],
  });

  const breakdownRows = totals.isVanLoad
    ? [
        { label: "Expected Sale", value: peso(totals.expectedSale), strong: true, large: true },
        { heading: "Total Actual Retrieved" },
        { label: "Actual Sale", value: peso(totals.vl_actual) },
        { label: "Returned With Content", value: `+ ${peso(totals.vl_retWc)}` },
        { label: "Discrepancies (Non-empty)", value: `+ ${peso(totals.vl_discNE)}` },
        { label: "Retrieved Total", value: peso(totals.vl_totalActualRetrieved), strong: true },
        { heading: "Overall Total" },
        { label: "Actual Sale", value: peso(totals.vl_actual) },
        { label: "Discrepancies (Empty)", value: `+ ${peso(totals.vl_discE)}` },
        { label: "Discrepancies (Non-empty)", value: `+ ${peso(totals.vl_discNE)}` },
        { label: "Overall Total", value: peso(totals.vl_overallTotal), strong: true },
        { label: "Expenses", value: `- ${peso(totals.expensesTotal)}` },
        { label: "Grand Total", value: peso(totals.vl_grandTotal), strong: true, large: true },
        { label: "Cash Received", value: peso(totals.cashReceived) },
        { label: "Change", value: peso(totals.change) },
      ]
    : [
        { label: "Actual Sales", value: peso(totals.actualSales), strong: true },
        { label: "Empties Price Total", value: peso(totals.emptiesPriceTotal) },
        { label: "Less Empty Returns", value: `- ${peso(totals.emptyReturns)}` },
        { label: "Discrepancy Total", value: peso(totals.emptyDiscrepancies), strong: true },
        { label: "Total Amount Due", value: peso(totals.totalAmount), strong: true, large: true },
        { label: "Cash Received", value: peso(totals.cashReceived) },
        { label: "Change", value: peso(totals.change) },
      ];

  const remarksLines = remarks ? doc.splitTextToSize(remarks, layout.innerW - 10) : [];
  const breakdownBoxHeight =
    14 +
    breakdownRows.reduce(
      (sum, row) => sum + (row.heading ? (layout.compact ? 5 : 6) : row.large ? 7 : layout.compact ? 5 : 6),
      0
    );
  const remarksHeight = remarksLines.length ? remarksLines.length * layout.infoLineHeight + 10 : 0;

  ensureSpace(breakdownBoxHeight + remarksHeight);

  const boxX = innerLeft;
  const boxY = y;
  const boxWidth = layout.innerW;
  const boxPad = layout.narrow ? 4 : 5;
  let lineY = boxY + boxPad + 2;

  doc.setDrawColor(209, 213, 219);
  doc.roundedRect(boxX, boxY, boxWidth, breakdownBoxHeight - 2, 2, 2, "S");

  doc.setFont("DejaVuSans", "bold");
  doc.setFontSize(layout.sectionTitleSize);
  text("PAYMENT BREAKDOWN", boxX + boxPad, lineY + 2);
  lineY += layout.compact ? 7 : 8;

  breakdownRows.forEach((row) => {
    if (row.heading) {
      doc.setFont("DejaVuSans", "bold");
      doc.setFontSize(layout.breakdownFontSize);
      text(row.heading, boxX + boxPad, lineY);
      lineY += layout.compact ? 5 : 6;
      return;
    }

    doc.setFont("DejaVuSans", row.strong ? "bold" : "normal");
    doc.setFontSize(row.large ? layout.breakdownFontSize + 0.8 : layout.breakdownFontSize);
    text(row.label, boxX + boxPad, lineY);
    text(row.value, boxX + boxWidth - boxPad, lineY, { align: "right" });
    lineY += row.large ? 7 : layout.compact ? 5 : 6;
  });

  y = boxY + breakdownBoxHeight + layout.sectionGap;

  if (remarksLines.length) {
    ensureSpace(remarksLines.length * layout.infoLineHeight + 10);
    doc.setFont("DejaVuSans", "bold");
    doc.setFontSize(layout.breakdownFontSize);
    text("Remarks", innerLeft, y);
    y += layout.compact ? 4.5 : 5.5;
    doc.setFont("DejaVuSans", "normal");
    doc.setFontSize(layout.bodyFontSize);
    text(remarksLines, innerLeft, y);
    y += remarksLines.length * layout.infoLineHeight + layout.sectionGap;
  }

  doc.save(`Invoice_${cleanText(payload?.invoiceNumber, "invoice")}.pdf`);
}
