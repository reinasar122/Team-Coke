import React, { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import api from "../api"; // adjust path if needed

// Access API base URL using process.env for compatibility
const Peso = (n) =>
  `₱${Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function WarehouseProductDetails() {
  const navigate = useNavigate();  
  const { mspNo } = useParams();
  const [sp] = useSearchParams();
  // const date = sp.get("date"); // keep if you plan to use it later
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ items: [], overall_total: 0 });
  const [errorMsg, setErrorMsg] = useState("");

  const currentWarehouse = useMemo(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    if ((user.role || "").toLowerCase() === "admin") {
      return selectedWarehouse || { id: user.warehouse_id, name: user.warehouse };
    }
    return { id: user.warehouse_id, name: user.warehouse };
  }, []); 

  // Format a Date to YYYY-MM-DD in Asia/Manila
  const toYMD_PH = (d) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);

  // Normalize API date to YYYY-MM-DD (handles ISO or "YYYY-MM-DD")
  const warehouseYMD = useMemo(() => {
    const ds = data?.date;
    if (!ds) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(ds)) return ds; // already YYYY-MM-DD
    const d = new Date(ds);
    return Number.isNaN(d.getTime()) ? null : toYMD_PH(d);
  }, [data?.date]);

  const todayYMD = useMemo(() => toYMD_PH(new Date()), []);
  const isTodayInPH = warehouseYMD === todayYMD;

  useEffect(() => {
    // wait until both mspNo and warehouse id exist
    if (!mspNo || !currentWarehouse?.id) return;

    setLoading(true);
    setErrorMsg("");
    api
  .get("/warehouse-details/", {
    params: {
      msp_no: mspNo,
      warehouse: currentWarehouse.id,
    },
  })
  .then((res) => setData(res.data || { items: [], overall_total: 0 }))
  .catch((err) => {
    console.error("Error loading details:", err);
    setErrorMsg(
      err?.response?.status === 404
        ? "No records found for that MSP No (route working but no matches)."
        : `Request failed: ${err?.response?.status || ""}`
    );
  })
  .finally(() => setLoading(false));
  
  }, [mspNo, currentWarehouse?.id]); // ← remove "date" for now

  // ——— Button handlers ———
  const handleBack = () => navigate("/trading");
  const handleNewSale = () => navigate("/merchandising-sale");

  return (
    <div className="warehousedetails-container">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          Warehouse Product Details — {mspNo}{data?.date ? ` (${data.date})` : ""}
        </h2>

         {/* Button group */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleBack}
            className="btn btn-back"
          >
            Back
          </button>
           {isTodayInPH ? (
              <button
                type="button"
                onClick={handleNewSale}
                className="btn btn-add"
              >
                New Sale
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="px-4 py-2 rounded-lg bg-gray-300 text-gray-600 cursor-not-allowed"
                title={warehouseYMD ? `Completed (${warehouseYMD})` : "Completed"}
              >
                Completed
              </button>
            )}
        </div>
      </div>

      <div className="table-wrapper">
        {loading ? (
          <div className="p-4">Loading…</div>
        ) : (
          <table className="table">
            <thead>
              <tr className="bg-gray-200 text-center">
                <th className="p-2 text-left">Product</th>
                <th className="p-2">Sold (Shell)</th>
                <th className="p-2">Sold (PCS)</th>
                <th className="p-2">Empty Returned (Shell)</th>
                <th className="p-2">Empty Returned (PCS)</th>
                <th className="p-2">Actual Sale</th>
              </tr>
            </thead>
            <tbody>
              {data.items?.map((it) => (
                <tr key={it.product} className="text-center border-b">
                  <td className="p-2 text-left">{it.product_name}</td>
                  <td className="p-2">{it.sold_shell}</td>
                  <td className="p-2">{it.sold_pcs}</td>
                  <td className="p-2">{it.returned_empty_shell}</td>
                  <td className="p-2">{it.returned_empty_pcs}</td>
                  <td className="p-2">{Peso(it.actual_sale)}</td>
                </tr>
              ))}
              {(!data.items || data.items.length === 0) && (
                <tr>
                  <td colSpan={6} className="text-center p-4 text-gray-500">No items for this MSP.</td>
                </tr>
              )}
            </tbody>
           <tfoot className="sticky bottom-0 z-10 bg-gray-100">
            <tr className="font-semibold">
              <td className="p-2 text-left" colSpan={5}>Overall Total</td>
              <td className="p-2 text-right">{Peso(data.overall_total)}</td>
            </tr>
          </tfoot>

          </table>
        )}
      </div>
    </div>
  );
}
