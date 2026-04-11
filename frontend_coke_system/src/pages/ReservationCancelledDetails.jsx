import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../api";

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
  if (sale.handled_by_name || sale.handled_by_username) {
    return sale.handled_by_name || sale.handled_by_username;
  }

  const handledBy = sale.handled_by;
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

const pickProductObject = (item, products) => {
  if (item.product_detail && typeof item.product_detail === "object") return item.product_detail;
  if (item.product && typeof item.product === "object") return item.product;

  const productId = item.product_id ?? item.product;
  return products.find((product) => String(product.id) === String(productId)) || null;
};

const pickProductName = (item, products) => {
  const product = pickProductObject(item, products) || {};
  return (
    item.product_name ||
    product.product_name ||
    product.name ||
    product.title ||
    `#${product.id ?? item.product_id ?? item.product ?? "--"}`
  );
};

const pickContentNo = (item, products) => {
  const product = pickProductObject(item, products) || {};
  return (
    Number(product?.unit_type?.content_no) ||
    Number(product?.unit_type_content_no) ||
    Number(product?.content_no) ||
    Number(item.content_no) ||
    1
  );
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

const EmptyState = ({ title = "Nothing to show", subtitle = "No reserved items found." }) => (
  <div className="rounded-xl border border-dashed border-gray-300 p-6 md:p-8 text-center">
    <div className="font-semibold text-gray-800">{title}</div>
    <div className="mt-1 text-sm text-gray-500">{subtitle}</div>
  </div>
);

const ReservationCancelledDetails = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const passedSale = location.state?.sale || null;

  const [sale, setSale] = useState(passedSale);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const loadData = async () => {
      setLoading(true);

      const productsRequest = api.get("/products/").catch(() => ({ data: [] }));
      const saleRequest = async () => {
        const urls = [`/merchandisings/${id}/`, `/merchandising/${id}/`];

        for (const url of urls) {
          try {
            const response = await api.get(url);
            return response.data;
          } catch (error) {
            // Try the fallback endpoint before using the passed list data.
          }
        }

        return passedSale || null;
      };

      const [productsResponse, saleData] = await Promise.all([productsRequest, saleRequest()]);

      if (!alive) return;
      setProducts(Array.isArray(productsResponse.data) ? productsResponse.data : []);
      setSale(saleData || passedSale || null);
    };

    loadData().finally(() => {
      if (alive) setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [id, passedSale]);

  const reservedRows = useMemo(() => {
    const items = Array.isArray(sale?.items) ? sale.items : [];

    return items.map((item, index) => {
      const contentNo = pickContentNo(item, products);
      const reservedPcs = firstNumber(item.dispatched_pcs, item.dispatchedPcs);
      const reservedShellRaw = num(item.dispatched_shell ?? item.dispatchedShell);
      const reservedShell =
        reservedShellRaw !== undefined ? reservedShellRaw : contentNo ? reservedPcs / contentNo : 0;

      return {
        id: item.id ?? `${item.product_id ?? item.product ?? "item"}-${index}`,
        productName: pickProductName(item, products),
        reservedShell,
        reservedPcs,
        contentNo,
      };
    });
  }, [products, sale?.items]);

  const totals = useMemo(
    () =>
      reservedRows.reduce(
        (acc, row) => {
          acc.shell += Number(row.reservedShell || 0);
          acc.pcs += Number(row.reservedPcs || 0);
          return acc;
        },
        { shell: 0, pcs: 0 }
      ),
    [reservedRows]
  );

  const statusText = sale?.status || "";
  const customerName = pickCustomerName(sale);
  const handledBy = pickHandledBy(sale);

  return (
    <div className="page w-full px-3 md:px-4 lg:px-5 xl:px-6 print:p-0">
      <div className="mb-3 md:mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-lg md:text-xl font-bold tracking-tight text-gray-900">Cancelled Reservation Details</h1>
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
          <EmptyState title="Reservation not found" subtitle="We could not locate this cancelled reservation." />
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
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Reserved Items</div>
            <div className="mt-0.5 text-base md:text-lg font-semibold">{reservedRows.length}</div>
          </div>
          <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Reserved (Shell)</div>
            <div className="mt-0.5 text-base md:text-lg font-semibold">{totals.shell}</div>
          </div>
          <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Reserved (PCS)</div>
            <div className="mt-0.5 text-base md:text-lg font-semibold">{totals.pcs}</div>
          </div>
        </div>
      )}

      {!loading && sale && (
        <div className="mt-4 rounded-lg bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden print:ring-0 print:shadow-none">
          <div className="px-3 py-2.5 border-b bg-gray-50 font-semibold text-sm">Reserved Items</div>
          {reservedRows.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No reserved items" subtitle="This cancelled reservation has no recorded reserved items." />
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-gray-600">
                    <th className="p-2 md:p-3 text-left font-medium">Product</th>
                    <th className="p-2 md:p-3 text-center font-medium">Reserved (Shell)</th>
                    <th className="p-2 md:p-3 text-center font-medium">Reserved (PCS)</th>
                    <th className="p-2 md:p-3 text-center font-medium">PCS per Shell</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reservedRows.map((row, index) => (
                    <tr key={row.id} className={index % 2 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="p-2 md:p-3 text-left text-gray-900">{row.productName}</td>
                      <td className="p-2 md:p-3 text-center">{row.reservedShell}</td>
                      <td className="p-2 md:p-3 text-center">{row.reservedPcs}</td>
                      <td className="p-2 md:p-3 text-center">{row.contentNo}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr className="font-semibold">
                    <td className="p-2 md:p-3 text-left">TOTAL</td>
                    <td className="p-2 md:p-3 text-center">{totals.shell}</td>
                    <td className="p-2 md:p-3 text-center">{totals.pcs}</td>
                    <td className="p-2 md:p-3 text-center">--</td>
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

export default ReservationCancelledDetails;