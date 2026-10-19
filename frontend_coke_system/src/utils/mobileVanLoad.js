export const mobileVanLoadRows = (batch, products) => batch.items.map((item, index) => {
  const product = products.find((entry) => Number(entry.id) === Number(item.product_id));
  if (!product) throw new Error(`Product ${item.product_name} could not be loaded. Refresh before dispatching.`);
  const contentNo = Number(product.unit_type?.content_no);
  return {
    id: index + 1, productId: product.id, productName: product.product_name,
    priceId: product.price?.id || null, contentNo: contentNo > 0 ? contentNo : "",
    dispatchedPcs: item.quantity,
    dispatchedShell: contentNo > 0 ? Number((item.quantity / contentNo).toFixed(2)) : "",
    soldPcs: 0, soldShell: 0,
    expectedReturnPcsEmpty: 0, expectedReturnShellEmpty: 0,
    expectedReturnPcsNonempty: 0, expectedReturnShellNonempty: 0,
    discrepancyPcsEmpty: 0, discrepancyShellEmpty: 0,
    discrepancyPcsNonempty: 0, discrepancyShellNonempty: 0,
    sellingPrice: product.price?.selling_price ?? "",
    shellPrice: product.price?.shell_price ?? "", bottlePrice: product.price?.bottle_price ?? "",
    discount: 0, expectedSale: 0, actualSale: 0,
  };
});

export const mobileReturnError = (batch, outcomes, rows) => {
  if (!batch || batch.orders.some((order) => !["DELIVERED", "RETURNED"].includes(outcomes[order.order_number]))) {
    return "Mark every mobile order as Accepted or Returned first.";
  }
  const sold = {};
  const returned = {};
  batch.orders.forEach((order) => {
    const totals = outcomes[order.order_number] === "DELIVERED" ? sold : returned;
    Object.entries(order.quantities).forEach(([pid, quantity]) => { totals[pid] = (totals[pid] || 0) + quantity; });
  });
  if (rows.some((row) => Number(row.sold_pcs || 0) !== (sold[row.productId] || 0) || Number(row.actual_return_pcs || 0) !== (returned[row.productId] || 0))) {
    return "Sold and returned full pieces must match the Accepted/Returned orders.";
  }
  return "";
};
