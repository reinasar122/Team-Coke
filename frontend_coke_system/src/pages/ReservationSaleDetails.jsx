import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../api";

const formatPhp = (value) =>
  Number.isFinite(Number(value))
    ? `\u20B1${Number(value).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "\u20B10.00";

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const firstNumber = (...values) => {
  for (const value of values) {
    const n = num(value);
    if (n !== undefined) return n;
  }
  return 0;
};

const formatToManila = (isoString) => {
  if (!isoString) return "";
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return "";

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
};

const formatPickupDate = (value) => {
  if (!value) return "--";
  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(parsed);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(parsed);
};

const StatusPill = ({ status }) => {
  const normalized = String(status || "").trim().toLowerCase();
  const base =
    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset";

  if (normalized.startsWith("complete") || normalized === "pickup" || normalized === "picked up" || normalized === "picked-up") {
    return (
      <span className={`${base} bg-green-50 text-green-800 ring-green-200`}>
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Picked Up
      </span>
    );
  }

  if (normalized === "reserved") {
    return (
      <span className={`${base} bg-orange-50 text-orange-800 ring-orange-200`}>
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
        Reserved
      </span>
    );
  }

  if (normalized === "cancelled" || normalized === "canceled") {
    return (
      <span className={`${base} bg-red-50 text-red-800 ring-red-200`}>
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Cancelled
      </span>
    );
  }

  return (
    <span className={`${base} bg-gray-50 text-gray-700 ring-gray-200`}>
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      {status || "--"}
    </span>
  );
};

const pickName = (item) => {
  const product = item.product_detail || item.product || {};
  return (
    item.product_name ||
    product.product_name ||
    product.name ||
    product.title ||
    `#${product.id ?? item.product_id ?? "--"}`
  );
};

const pickContentNo = (item) => {
  const product = item.product_detail || item.product || {};
  return (
    Number(product?.unit_type?.content_no) ||
    Number(product?.unit_type_content_no) ||
    Number(product?.content_no) ||
    Number(item.content_no) ||
    1
  );
};

const pickSellingPrice = (item) =>
  firstNumber(
    item.selling_price,
    item.unit_price,
    item.price,
    item.product_detail?.price?.selling_price,
    item.product?.price?.selling_price
  );

const pickCustomerName = (sale) => {
  if (!sale) return "--";
  if (sale.customer_name) return sale.customer_name;

  const customer = sale.customer;
  if (customer && typeof customer === "object") {
    return (
      customer.name ||
      customer.customer_name ||
      customer.full_name ||
      [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
      "--"
    );
  }

  return sale.customer ? `Customer #${sale.customer}` : "Walk-in Customer";
};

const pickHandledBy = (sale) => {
  if (!sale) return "--";
  const handledBy = sale.handled_by;

  if (sale.handled_by_name || sale.handled_by_username) {
    return sale.handled_by_name || sale.handled_by_username;
  }

  if (handledBy && typeof handledBy === "object") {
    return (
      [handledBy.first_name, handledBy.last_name].filter(Boolean).join(" ") ||
      handledBy.username ||
      handledBy.name ||
      "--"
    );
  }

  return handledBy || "--";
};

const InfoField = ({ label, value }) => (
  <div className="space-y-1">
    <div className="text-xs text-gray-500">{label}</div>
    <div className="w-full rounded-lg px-3 py-2 bg-gray-50 border border-gray-200 text-sm text-gray-800">
      {value ?? "--"}
    </div>
  </div>
);

const Line = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

const HeaderSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
    {[...Array(6)].map((_, index) => (
      <div key={index} className="space-y-2">
        <Line className="h-3 w-24" />
        <Line className="h-9 w-full" />
      </div>
    ))}
  </div>
);

const EmptyState = ({ title = "Nothing to show", subtitle = "No items found for this reservation." }) => (
  <div className="rounded-xl border border-dashed border-gray-300 p-6 md:p-8 text-center">
    <div className="font-semibold text-gray-800">{title}</div>
    <div className="mt-1 text-sm text-gray-500">{subtitle}</div>
  </div>
);

const normalizeMiscItem = (item, index) => {
  if (!item) return null;
  const amount = firstNumber(item.amount, item.total, item.value, item.price);
  const description =
    item.description ||
    item.desc ||
    item.name ||
    item.title ||
    item.label ||
    item.note ||
    `Misc #${index + 1}`;

  return { description: String(description), amount };
};

const getMiscList = (sale) => {
  const rawItems = [
    ...(Array.isArray(sale?.misc_items) ? sale.misc_items : []),
    ...(Array.isArray(sale?.expense_items) ? sale.expense_items : []),
    ...(Array.isArray(sale?.miscellaneous) ? sale.miscellaneous : []),
    ...(Array.isArray(sale?.expenses) ? sale.expenses : []),
    ...(Array.isArray(sale?.fees) ? sale.fees : []),
  ];

  [sale?.misc_item, sale?.misc, sale?.expense, sale?.fee].forEach((item) => {
    if (item && typeof item === "object") rawItems.push(item);
  });

  const list = rawItems.map((item, index) => normalizeMiscItem(item, index)).filter(Boolean);
  const fallbackTotal = firstNumber(
    sale?.expenses_total,
    sale?.total_expenses,
    sale?.misc_amount,
    sale?.fees_total,
    sale?.miscellaneous
  );

  if (list.length === 0 && fallbackTotal > 0) {
    list.push({ description: "Miscellaneous", amount: fallbackTotal });
  }

  return list;
};

const ReservationSaleDetails = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const passedSale = location.state?.sale || null;

  const [sale, setSale] = useState(passedSale);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const loadSale = async () => {
      setLoading(true);
      const urls = [`/merchandisings/${id}/`, `/merchandising/${id}/`];

      for (const url of urls) {
        try {
          const response = await api.get(url);
          if (alive) setSale(response.data || passedSale || null);
          return;
        } catch (error) {
          // Try the fallback endpoint before using the passed list data.
        }
      }

      if (alive) setSale(passedSale || null);
    };

    loadSale().finally(() => {
      if (alive) setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [id, passedSale]);

  const items = useMemo(() => (Array.isArray(sale?.items) ? sale.items : []), [sale]);

  const soldRows = useMemo(() => {
    return items.map((item) => {
      const contentNo = pickContentNo(item);
      const soldShell = firstNumber(item.sold_shell, item.soldShell);
      const soldPcsRaw = firstNumber(item.sold_pcs, item.soldPcs, item.qty, item.quantity);
      const soldPcs = soldPcsRaw > 0 ? soldPcsRaw : soldShell * contentNo;
      const sellingPrice = pickSellingPrice(item);
      const discountPercent = firstNumber(item.discount_percent, item.discount);
      const directTotal = firstNumber(item.actual_sale, item.actualSale, item.line_total, item.lineTotal);
      const fallbackTotal = Number((soldPcs * sellingPrice * (1 - discountPercent / 100)).toFixed(2));
      const lineTotal = directTotal > 0 ? directTotal : fallbackTotal;

      return {
        name: pickName(item),
        soldShell,
        soldPcs,
        sellingPrice,
        discountPercent,
        lineTotal,
      };
    });
  }, [items]);

  const soldTotals = useMemo(
    () =>
      soldRows.reduce(
        (acc, row) => {
          acc.shell += row.soldShell;
          acc.pcs += row.soldPcs;
          acc.amount += row.lineTotal;
          return acc;
        },
        { shell: 0, pcs: 0, amount: 0 }
      ),
    [soldRows]
  );

  const miscList = useMemo(() => getMiscList(sale), [sale]);
  const expensesTotal = useMemo(
    () => miscList.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [miscList]
  );

  const emptiesRows = useMemo(() => {
    return items.map((item) => ({
      name: pickName(item),
      emptyShell: firstNumber(item.empty_return_shell, item.emptyReturnShell),
      emptyPcs: firstNumber(item.empty_return_pcs, item.emptyReturnPcs),
      withContentShell: firstNumber(item.actual_return_shell, item.actualReturnShell),
      withContentPcs: firstNumber(item.actual_return_pcs, item.actualReturnPcs),
    }));
  }, [items]);

  const emptiesTotals = useMemo(
    () =>
      emptiesRows.reduce(
        (acc, row) => {
          acc.emptyShell += row.emptyShell;
          acc.emptyPcs += row.emptyPcs;
          acc.withContentShell += row.withContentShell;
          acc.withContentPcs += row.withContentPcs;
          return acc;
        },
        { emptyShell: 0, emptyPcs: 0, withContentShell: 0, withContentPcs: 0 }
      ),
    [emptiesRows]
  );

  const statusText = sale?.status || "";
  const customerName = pickCustomerName(sale);
  const handledBy = pickHandledBy(sale);
  const displayTotal = firstNumber(sale?.actual_sale) > 0 ? firstNumber(sale?.actual_sale) : soldTotals.amount;

  return (
    <div className="page w-full px-3 md:px-4 lg:px-5 xl:px-6 print:p-0">
      <div className="mb-3 md:mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-lg md:text-xl font-bold tracking-tight text-gray-900">Reservation Sale Details</h1>
        <div className="flex gap-2">
          <button
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => navigate("/reservationlist")}
          >
            Back
          </button>
          <button
            className="inline-flex items-center rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black"
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>
      </div>

      <div className="bg-white p-4 md:p-5 rounded-lg md:rounded-xl shadow-sm ring-1 ring-gray-200 print:ring-0 print:shadow-none">
        {loading ? (
          <HeaderSkeleton />
        ) : !sale ? (
          <EmptyState title="Reservation not found" subtitle="We could not locate this reservation sale." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            <InfoField label="MSP No" value={sale.msp_no} />
            <InfoField label="Date & Time" value={formatToManila(sale.date_time)} />
            <InfoField label="Transaction Type" value={sale.transaction_type_name || "Warehouse Reservation"} />
            <InfoField label="Customer" value={customerName} />
            <InfoField label="Pickup Date" value={formatPickupDate(sale.reserved_date)} />
            <InfoField label="Handled By" value={handledBy} />
            <InfoField label="Status" value={<StatusPill status={statusText} />} />
          </div>
        )}
      </div>

      {!loading && sale && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 gap-3">
          <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Sold (Shell)</div>
            <div className="mt-0.5 text-base md:text-lg font-semibold">{soldTotals.shell}</div>
          </div>
          <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Sold (PCS)</div>
            <div className="mt-0.5 text-base md:text-lg font-semibold">{soldTotals.pcs}</div>
          </div>
          <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Total Units (PCS)</div>
            <div className="mt-0.5 text-base md:text-lg font-semibold">{soldTotals.pcs}</div>
          </div>
          <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Actual Sale</div>
            <div className="mt-0.5 text-base md:text-lg font-semibold">{formatPhp(displayTotal)}</div>
          </div>
        </div>
      )}

      {!loading && sale && (
        <div className="mt-4 rounded-lg bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden print:ring-0 print:shadow-none">
          <div className="px-3 py-2.5 border-b bg-gray-50 font-semibold text-sm">Products Sold</div>
          {soldRows.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No sold items" subtitle="This reservation has no recorded picked-up sales." />
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-gray-600">
                    <th className="p-2 md:p-3 text-left font-medium">Product</th>
                    <th className="p-2 md:p-3 text-center font-medium">Sold (Shell)</th>
                    <th className="p-2 md:p-3 text-center font-medium">Sold (PCS)</th>
                    <th className="p-2 md:p-3 text-center font-medium">Unit Price</th>
                    <th className="p-2 md:p-3 text-center font-medium">Discount (%)</th>
                    <th className="p-2 md:p-3 text-right font-medium">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {soldRows.map((row, index) => (
                    <tr key={index} className={index % 2 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="p-2 md:p-3 text-left text-gray-900">{row.name}</td>
                      <td className="p-2 md:p-3 text-center">{row.soldShell}</td>
                      <td className="p-2 md:p-3 text-center">{row.soldPcs}</td>
                      <td className="p-2 md:p-3 text-center">{formatPhp(row.sellingPrice)}</td>
                      <td className="p-2 md:p-3 text-center">{row.discountPercent}</td>
                      <td className="p-2 md:p-3 text-right font-medium">{formatPhp(row.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr className="font-semibold">
                    <td className="p-2 md:p-3 text-left" colSpan={5}>TOTAL</td>
                    <td className="p-2 md:p-3 text-right">{formatPhp(displayTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && sale && (
        <div className="mt-4 rounded-lg bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <div className="px-3 py-2.5 border-b bg-gray-50 font-semibold text-sm">Miscellaneous / Expenses</div>
          {miscList.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No miscellaneous charges recorded.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-gray-600">
                    <th className="p-2 md:p-3 text-left font-medium">Description</th>
                    <th className="p-2 md:p-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {miscList.map((item, index) => (
                    <tr key={index} className={index % 2 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="p-2 md:p-3 text-gray-900">{item.description}</td>
                      <td className="p-2 md:p-3 text-right">{formatPhp(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr className="font-semibold">
                    <td className="p-2 md:p-3 text-left">TOTAL</td>
                    <td className="p-2 md:p-3 text-right">{formatPhp(expensesTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && sale && (
        <div className="mt-4 rounded-lg bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden print:break-before-page print:ring-0 print:shadow-none">
          <div className="px-3 py-2.5 border-b bg-gray-50 font-semibold text-sm">Empties Returned</div>
          {emptiesRows.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No empties" subtitle="No empty or with-content returns recorded." />
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-gray-600">
                    <th className="p-2 md:p-3 text-left font-medium">Product</th>
                    <th className="p-2 md:p-3 text-center font-medium">Empty (Shell)</th>
                    <th className="p-2 md:p-3 text-center font-medium">Empty (PCS)</th>
                    <th className="p-2 md:p-3 text-center font-medium">With Contents (Shell)</th>
                    <th className="p-2 md:p-3 text-center font-medium">With Contents (PCS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {emptiesRows.map((row, index) => (
                    <tr key={index} className={index % 2 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="p-2 md:p-3 text-left text-gray-900">{row.name}</td>
                      <td className="p-2 md:p-3 text-center">{row.emptyShell}</td>
                      <td className="p-2 md:p-3 text-center">{row.emptyPcs}</td>
                      <td className="p-2 md:p-3 text-center">{row.withContentShell}</td>
                      <td className="p-2 md:p-3 text-center">{row.withContentPcs}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr className="font-semibold text-gray-800">
                    <td className="p-2 md:p-3 text-left">TOTAL</td>
                    <td className="p-2 md:p-3 text-center">{emptiesTotals.emptyShell}</td>
                    <td className="p-2 md:p-3 text-center">{emptiesTotals.emptyPcs}</td>
                    <td className="p-2 md:p-3 text-center">{emptiesTotals.withContentShell}</td>
                    <td className="p-2 md:p-3 text-center">{emptiesTotals.withContentPcs}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReservationSaleDetails;