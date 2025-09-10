export const getConversion = (product) =>
  parseFloat(product?.unit_type?.content_no || 1);

export const syncShellToPcs = (shell, conversion) =>
  Math.round(parseFloat(shell || 0) * conversion);

export const syncPcsToShell = (pcs, conversion) =>
  (parseFloat(pcs || 0) / conversion).toFixed(2);

export const calculateDiscount = (price, soldPcs, discountPercent) =>
  (price * soldPcs * discountPercent) / 100;

export const computeTotal = (rows, pricingMap, fieldShell, fieldPcs, shellKey, pcsKey) =>
  rows.reduce((sum, row) => {
    const price = pricingMap[row.priceId] || {};
    const shellPrice = parseFloat(price[shellKey]) || 0;
    const pcsPrice = parseFloat(price[pcsKey]) || 0;
    const shellQty = parseFloat(row[fieldShell] || 0);
    const pcsQty = parseFloat(row[fieldPcs] || 0);
    return sum + (shellQty * shellPrice) + (pcsQty * pcsPrice);
  }, 0);
