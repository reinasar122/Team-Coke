import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api"; // adjust path if needed

// Access API base URL using process.env for compatibility
const Peso = (n) =>
  `${Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function WarehouseProductDetails() {
  const navigate = useNavigate();  
  const { mspNo } = useParams();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ items: [], overall_total: 0 });

  const currentWarehouse = useMemo(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    if ((user.role || "").toLowerCase() === "admin") {
      return selectedWarehouse || { id: user.warehouse_id, name: user.warehouse };
    }
    return { id: user.warehouse_id, name: user.warehouse };
  }, []); 
  useEffect(() => {
    // wait until both mspNo and warehouse id exist
    if (!mspNo || !currentWarehouse?.id) return;

    setLoading(true);
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
  })
  .finally(() => setLoading(false));
  
  }, [mspNo, currentWarehouse?.id]); // <- remove "date" for now

  // --- Button handlers ---
  const handleBack = () => navigate("/trading");
  const isReserved = String(data?.status || "").toLowerCase() === "reserved";
  const isPickedUp =
    ["picked up", "picked-up", "complete", "completed"].includes(
      String(data?.status || "").trim().toLowerCase()
    );

  return (
    <div className="warehousedetails-container">
      <div className="page-header mb-4">
        <div>
          <h2 className="text-lg font-semibold">
            Warehouse Product Details - {mspNo}{data?.date ? ` (${data.date})` : ""}
          </h2>
          {isReserved && data?.reserved_date && (
            <p className="mt-1 text-sm font-medium text-amber-700">
              Reserved pickup date: {data.reserved_date}
            </p>
          )}
          {isPickedUp && data?.actual_pickup_date && (
            <p className="mt-1 text-sm font-medium text-emerald-700">
              Actual pickup date: {data.actual_pickup_date}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleBack}
          className="btn btn-back"
        >
          Back
        </button>
      </div>

      <div className="table-wrapper">
        {loading ? (
          <div className="p-4">Loading…</div>
        ) : (
          <table className="table">
            <thead>
              <tr className="bg-gray-200 text-center">
                <th className="p-2 text-left">Product</th>
                <th className="p-2">{isReserved ? "Reserved (Shell)" : "Sold (Shell)"}</th>
                <th className="p-2">{isReserved ? "Reserved (PCS)" : "Sold (PCS)"}</th>
                <th className="p-2">Empty Returned (Shell)</th>
                <th className="p-2">Empty Returned (PCS)</th>
                <th className="p-2">Actual Sale</th>
              </tr>
            </thead>
            <tbody>
              {data.items?.map((it) => (
                <tr key={it.product} className="text-center border-b">
                  <td className="p-2 text-left">{it.product_name}</td>
                  <td className="p-2">{isReserved ? it.display_shell : it.sold_shell}</td>
                  <td className="p-2">{isReserved ? it.display_pcs : it.sold_pcs}</td>
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
