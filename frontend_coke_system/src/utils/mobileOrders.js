const statusLabels = {
  PENDING: ["Pending", "pending"],
  NEW: ["New", "new"],
  CONFIRMED: ["Confirmed", "confirmed"],
  ORDER_CONFIRMED: ["Confirmed", "confirmed"],
  PROCESSING: ["Processing", "processing"],
  IN_PROGRESS: ["In Progress", "processing"],
  OUT_FOR_DELIVERY: ["Out for Delivery", "processing"],
  SHIPPED: ["Shipped", "processing"],
  COMPLETED: ["Completed", "completed"],
  COMPLETE: ["Completed", "completed"],
  DELIVERED: ["Delivered", "completed"],
  PICKED_UP: ["Picked Up", "completed"],
  CANCELLED: ["Cancelled", "cancelled"],
  CANCELED: ["Cancelled", "cancelled"],
  RETURNED: ["Returned", "returned"],
};

export const toPurchaseCard = (order) => {
  const rawStatus = String(order.status || "Unknown");
  const statusKey = rawStatus.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const [status, statusClass] = statusLabels[statusKey] || [rawStatus, "unknown"];
  const date = order.created_at ? new Date(order.created_at) : null;
  const validDate = date && !Number.isNaN(date.getTime());

  return {
    id: order.order_number,
    number: order.mobile_order_number || order.order_number,
    customer: order.customer_name || "Customer name unavailable",
    address: order.order_address?.trim() || order.customer_address || "Address unavailable",
    status,
    rawStatus: statusKey,
    statusClass,
    deliveryId: order.delivery_id || null,
    deliveryAddress: order.delivery_address || "",
    vanLoadBatchId: order.van_load_batch_id || null,
    vanLoadSaleId: order.van_load_sale_id || null,
    isTest: Boolean(order.is_test),
    createdAt: validDate ? date.toISOString() : undefined,
    dateLabel: validDate ? new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
    }).format(date) : "Order time unavailable",
    time: validDate ? new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: true,
    }).format(date) : "—",
    total: order.total_amount,
    products: (order.products || []).map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discountPercent: item.discount_percent,
      lineTotal: item.line_total,
      image: item.image_url,
    })),
  };
};
