import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../api";
import { showAppAlertDialog, showAppConfirmDialog } from "../components/common/modalDialogs";

const peso = (value) =>
  `\u20B1${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatToManila = (isoString) => {
  if (!isoString) return "";
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return "";

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
    timeZone: "Asia/Manila",
  }).format(parsed);
};

const formatPickupDate = (value) => {
  if (!value) return "";
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

const InfoField = ({ label, value }) => (
  <div className="flex flex-col gap-1">
    <label className="text">{label}</label>
    <input
      value={value ?? ""}
      readOnly
      className="w-full bg-gray-100 text rounded px-3 py-2"
    />
  </div>
);

const ReadOnlyReservationTable = ({ items, availableStock }) => (
  <div className="table-wrapper">
    <table className="table">
      <thead>
        <tr>
          <th className="border px-2 py-2 text-left">Product</th>
          <th className="border px-2 py-2 text-center">Available</th>
          <th className="border px-2 py-2 text-center" colSpan={2}>
            Dispatched
          </th>
          <th className="border px-2 py-2 text-center">Selling Price</th>
          <th className="border px-2 py-2 text-center" colSpan={2}>
            Empty Price
          </th>
          <th className="border px-2 py-2 text-center">Discount (%)</th>
          <th className="border px-2 py-2 text-center">
            Expected Sale without Discount
          </th>
          <th className="border px-2 py-2 text-center">
            Expected Sale with Discount
          </th>
        </tr>
        <tr className="bg-slate-100">
          <td className="border px-2 py-1"></td>
          <td className="border px-2 py-1 text-center">PCS</td>
          <td className="border px-2 py-1 text-center">Shell</td>
          <td className="border px-2 py-1 text-center">PCS</td>
          <td className="border px-2 py-1"></td>
          <td className="border px-2 py-1 text-center">Shell</td>
          <td className="border px-2 py-1 text-center">PCS</td>
          <td className="border px-2 py-1 text-center">%</td>
          <td className="border px-2 py-1 text-center">PCS</td>
          <td className="border px-2 py-1 text-center">PCS</td>
        </tr>
      </thead>

      <tbody className="bg-white">
        {items.length === 0 ? (
          <tr>
            <td className="px-4 py-4 text" colSpan={10}>
              No products.
            </td>
          </tr>
        ) : (
          items.map((item) => {
            const available = availableStock[Number(item.productId)];
            const availableDisplay =
              typeof available === "number" || available === 0 ? available : "--";

            return (
              <tr key={item.id} className="hover:bg-gray-50 transition">
                <td className="border border-gray-200 py-1 px-1 w-[240px]">
                  <input
                    readOnly
                    className="w-full text-md text-left rounded py-1 px-2 bg-white border"
                    value={item.productName || ""}
                  />
                </td>
                <td className="border border-gray-200 py-1 px-1 text-sm text-center">
                  {availableDisplay}
                </td>
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    readOnly
                    className="input-always-spinner input text-center bg-yellow-50 w-full"
                    value={
                      item.dispatchedShell !== undefined && item.dispatchedShell !== null
                        ? Number(item.dispatchedShell) % 1 === 0
                          ? parseInt(item.dispatchedShell, 10)
                          : Number(item.dispatchedShell).toFixed(2)
                        : ""
                    }
                  />
                </td>
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    readOnly
                    className="input-always-spinner input text-center bg-yellow-50 w-full"
                    value={
                      item.dispatchedPcs || item.dispatchedPcs === 0
                        ? parseFloat(item.dispatchedPcs) % 1 === 0
                          ? parseInt(item.dispatchedPcs, 10)
                          : parseFloat(item.dispatchedPcs).toFixed(2)
                        : ""
                    }
                  />
                </td>
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    readOnly
                    className="w-full p-1 text-sm text-center bg-gray-100 border rounded"
                    value={
                      item.sellingPricePc !== "" && item.sellingPricePc != null
                        ? peso(item.sellingPricePc)
                        : ""
                    }
                  />
                </td>
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    readOnly
                    className="w-full p-1 text-sm text-center bg-gray-100 border rounded"
                    value={item.shellPrice !== "" && item.shellPrice != null ? peso(item.shellPrice) : ""}
                  />
                </td>
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    readOnly
                    className="w-full p-1 text-sm text-center bg-gray-100 border rounded"
                    value={
                      item.bottlePrice !== "" && item.bottlePrice != null
                        ? peso(item.bottlePrice)
                        : ""
                    }
                  />
                </td>
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    readOnly
                    className="w-full p-1 text-sm text-center bg-gray-100 border rounded"
                    value={
                      item.discount !== undefined && item.discount !== null
                        ? `${Number(item.discount).toFixed(2)}%`
                        : ""
                    }
                  />
                </td>
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    readOnly
                    className="w-full p-1 text-center bg-gray-50 text-gray-800 font-medium border rounded"
                    value={
                      Number.isFinite(Number(item.expectedSaleWithoutDiscount))
                        ? peso(item.expectedSaleWithoutDiscount)
                        : ""
                    }
                  />
                </td>
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    readOnly
                    className="w-full p-1 text-center bg-gray-50 text-gray-800 font-medium border rounded"
                    value={Number.isFinite(Number(item.expectedSale)) ? peso(item.expectedSale) : ""}
                  />
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </div>
);

const resolveWarehouseFromStorage = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const selectedWarehouse = JSON.parse(
    localStorage.getItem("selectedWarehouse") || "null"
  );

  if ((user.role || "").toLowerCase() === "admin") {
    return selectedWarehouse || { id: user.warehouse_id, name: user.warehouse };
  }

  return { id: user.warehouse_id, name: user.warehouse };
};

export default function ReservationDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const passedSale = location.state?.sale || null;

  const [currentWarehouse, setCurrentWarehouse] = useState(() =>
    resolveWarehouseFromStorage()
  );
  const [sale, setSale] = useState(passedSale);
  const [loading, setLoading] = useState(!passedSale);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [availableStock, setAvailableStock] = useState({});
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    const handleWarehouseChange = (event) => {
      const nextWarehouse = event.detail?.warehouse || resolveWarehouseFromStorage();
      setCurrentWarehouse(nextWarehouse);
    };

    window.addEventListener("warehouseChanged", handleWarehouseChange);
    return () => window.removeEventListener("warehouseChanged", handleWarehouseChange);
  }, []);

  useEffect(() => {
    let active = true;

    const loadBaseData = async () => {
      setLoading(true);

      try {
        const saleRequest = async () => {
          const urls = [`/merchandisings/${id}/`, `/merchandising/${id}/`];

          for (const url of urls) {
            try {
              const response = await api.get(url);
              return response.data;
            } catch (error) {
              // try the next fallback URL
            }
          }

          return passedSale;
        };

        const [productsResponse, usersResponse, saleData] = await Promise.all([
          api.get("/products/").catch(() => ({ data: [] })),
          api.get("/users/").catch(() => ({ data: [] })),
          saleRequest(),
        ]);

        if (!active) return;

        setProducts(Array.isArray(productsResponse.data) ? productsResponse.data : []);
        setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
        setSale(saleData || passedSale || null);
      } catch (error) {
        console.error("Failed to load reservation detail:", error);
        if (active) {
          setSale(passedSale || null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadBaseData();

    return () => {
      active = false;
    };
  }, [id, passedSale]);

  useEffect(() => {
    if (!currentWarehouse?.id) {
      setCustomers([]);
      setAvailableStock({});
      return;
    }

    let active = true;

    const loadWarehouseData = async () => {
      try {
        const [customersResponse, stocksResponse] = await Promise.all([
          api.get("/customers/", { params: { warehouse: currentWarehouse.id } }).catch(() => ({
            data: [],
          })),
          api.get("/stocks/", { params: { warehouse: currentWarehouse.id } }).catch(() => ({
            data: [],
          })),
        ]);

        if (!active) return;

        setCustomers(Array.isArray(customersResponse.data) ? customersResponse.data : []);

        const nextStockMap = {};
        (Array.isArray(stocksResponse.data) ? stocksResponse.data : []).forEach((row) => {
          const productId = Number(row.product_id ?? row.product);
          if (productId) {
            nextStockMap[productId] = Number(row.quantity_available ?? row.quantity ?? 0) || 0;
          }
        });
        setAvailableStock(nextStockMap);
      } catch (error) {
        console.error("Failed to load reservation warehouse data:", error);
        if (active) {
          setCustomers([]);
          setAvailableStock({});
        }
      }
    };

    loadWarehouseData();

    return () => {
      active = false;
    };
  }, [currentWarehouse?.id]);

  const reservationItems = useMemo(() => {
    const items = Array.isArray(sale?.items) ? sale.items : [];

    return items.map((item) => {
      const productId =
        typeof item.product === "object" ? item.product?.id : item.product ?? item.product_id;
      const productObject =
        (typeof item.product === "object" && item.product) ||
        (item.product_detail && typeof item.product_detail === "object"
          ? item.product_detail
          : null) ||
        products.find((product) => Number(product.id) === Number(productId));
      const price = productObject?.price || item.price || {};
      const contentNo =
        productObject?.unit_type?.content_no ??
        item.product?.unit_type?.content_no ??
        item.content_no ??
        1;
      const dispatchedPcs = Number(item.dispatched_pcs ?? item.dispatchedPcs ?? 0);
      const dispatchedShell =
        item.dispatched_shell !== undefined && item.dispatched_shell !== null
          ? Number(item.dispatched_shell)
          : contentNo > 0
            ? Math.floor(dispatchedPcs / contentNo)
            : 0;
      const sellingPricePc = Number(
        price.selling_price ?? item.selling_price ?? item.unit_price ?? 0
      );
      const discount = Number(item.discount_percent ?? item.discount ?? 0);
      const expectedSaleWithoutDiscount = Number(
        (sellingPricePc * dispatchedPcs).toFixed(2)
      );
      const expectedSale = Number(
        (expectedSaleWithoutDiscount * (1 - discount / 100)).toFixed(2)
      );

      return {
        id: item.id ?? `${productId}-${dispatchedPcs}`,
        productId,
        productName:
          productObject?.product_name ||
          item.product_name ||
          item.product?.product_name ||
          "",
        contentNo,
        sellingPricePc,
        shellPrice: Number(price.shell_price ?? item.shell_price ?? 0),
        bottlePrice: Number(price.bottle_price ?? item.bottle_price ?? 0),
        dispatchedPcs,
        dispatchedShell,
        discount,
        expectedSaleWithoutDiscount,
        expectedSale,
      };
    });
  }, [products, sale?.items]);

  const handlerName = useMemo(() => {
    const handledBy = sale?.handled_by;
    if (!handledBy) return "";

    if (typeof handledBy === "object") {
      return `${handledBy.first_name || ""} ${handledBy.last_name || ""}`.trim();
    }

    const matchedUser = users.find((user) => Number(user.id) === Number(handledBy));
    if (matchedUser) {
      return `${matchedUser.first_name || ""} ${matchedUser.last_name || ""}`.trim();
    }

    return String(handledBy);
  }, [sale?.handled_by, users]);

  const customerName = useMemo(() => {
    if (sale?.customer_name) return sale.customer_name;

    if (sale?.customer && typeof sale.customer === "object") {
      return (
        sale.customer.name ||
        sale.customer.customer_name ||
        sale.customer.full_name ||
        ""
      );
    }

    const customerId =
      typeof sale?.customer === "object" ? sale.customer?.id : sale?.customer ?? sale?.customer_id;
    const matchedCustomer = customers.find(
      (customer) => String(customer.id) === String(customerId)
    );

    return matchedCustomer?.name || matchedCustomer?.customer_name || "";
  }, [customers, sale?.customer, sale?.customer_id, sale?.customer_name]);

  const status = String(sale?.status || "").trim().toLowerCase();

  useEffect(() => {
    if (!loading && status === "complete") {
      navigate("/reservationlist", { replace: true });
    }
  }, [loading, navigate, status]);

  const canRemit = status === "reserved";

  const canCancel = status === "reserved";

  const handleEditReservation = () => {
    if (!sale?.id) return;

    navigate("/merchandising-sale", {
      state: {
        sale,
        editMode: true,
        reservationMode: true,
        reservationAction: "edit",
      },
    });
  };

  const handleRemittance = () => {
    if (!sale?.id) return;

    navigate("/merchandising-sale", {
      replace: true,
      state: {
        sale,
        editMode: true,
        reservationMode: true,
        reservationAction: "remittance",
      },
    });
  };

  const handleCancelReservation = async () => {
    if (!sale?.id || !canCancel || isCancelling) return;

    const confirmed = await showAppConfirmDialog({
      title: "Cancel Reservation",
      message: "Are you sure you want to cancel this reservation?",
      details: "The reserved stock will be returned to warehouse stocks.",
      confirmLabel: "Cancel Reservation",
      cancelLabel: "Keep Reservation",
      danger: true,
      size: "sm",
    });

    if (!confirmed) return;

    try {
      setIsCancelling(true);
      await api.patch(`/merchandisings/${sale.id}/`, { status: "Cancelled" });
      navigate("/reservationlist");
    } catch (error) {
      console.error("Failed to cancel reservation:", error);
      const details =
        typeof error?.response?.data === "string"
          ? error.response.data
          : JSON.stringify(error?.response?.data || error.message || "Unknown error", null, 2);

      await showAppAlertDialog({
        title: "Cancellation Failed",
        message: "Unable to cancel this reservation right now.",
        details,
        danger: true,
        size: "sm",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="page-header">
          <div>
            <span className="text">Current Warehouse: </span>
            <span className="font-bold text-lg">
              {currentWarehouse?.name || "No Warehouse Selected"}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-back"
            onClick={() => navigate("/reservationlist")}
          >
            Back
          </button>
        </div>
      </div>

      <div className="border-none p-6">
        <div className="p-1">
          <h2 className="text-2xl font-bold mb-6">Reservation Details</h2>
        </div>

        {loading ? (
          <div className="text-sm text-gray-600">Loading reservation details...</div>
        ) : !sale ? (
          <div className="text-sm text-red-600">Reservation not found.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <InfoField label="MSP No" value={sale.msp_no || ""} />
              <InfoField label="Date Time" value={formatToManila(sale.date_time)} />
              <InfoField
                label="Transaction Type"
                value={sale.transaction_type_name || "Warehouse"}
              />
              <InfoField
                label="Customer Name"
                value={customerName || "Walk-in Customer"}
              />
              <InfoField label="Pick Date" value={formatPickupDate(sale.reserved_date)} />
              <InfoField label="Handled By" value={handlerName} />
            </div>

            <h3 className="mt-8 mb-3 text-lg font-semibold">
              Products ({reservationItems.length})
            </h3>
            <ReadOnlyReservationTable
              items={reservationItems}
              availableStock={availableStock}
            />
          </>
        )}
      </div>

      {!loading && sale && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 px-6">
          <div>
            {canCancel && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleCancelReservation}
                disabled={isCancelling}
              >
                {isCancelling ? "Cancelling..." : "Cancel Reservation"}
              </button>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-3 ml-auto">
            <button
              type="button"
              className="btn btn-edit"
              onClick={handleEditReservation}
            >
              Edit Reservation
            </button>
            {canRemit && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRemittance}
              >
                Remittance
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}










