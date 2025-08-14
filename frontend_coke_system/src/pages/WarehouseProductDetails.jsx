// src/pages/WarehouseProductDetails.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE =
  (import.meta?.env?.VITE_API_BASE ||
   process.env.REACT_APP_API_BASE ||
   "http://localhost:8080"); // make sure this is correct for your backend

const Peso = (n) => `₱${Number(n || 0).toFixed(2)}`;

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

  useEffect(() => {
    // wait until both mspNo and warehouse id exist
    if (!mspNo || !currentWarehouse?.id) return;

    setLoading(true);
    setErrorMsg("");
    const url = `${API_BASE}/api/warehouse-details/`;
    const params = {
      msp_no: mspNo,
      warehouse: currentWarehouse.id,
      // date, // add back later if you want strict same‑day results
    };
    // quick visibility while debugging:
    console.log("GET", url, params);

    


    axios
      .get(url, { params })
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
    <div className="p-6 bg-sky-200 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          Warehouse Product Details — {mspNo}{data?.date ? ` (${data.date})` : ""}
        </h2>


         {/* Button group */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 rounded-lg border border-sky-300 bg-white text-sky-700 hover:bg-gray-50 active:translate-y-[1px] transition"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNewSale}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm active:translate-y-[1px] transition"
          >
            New Sale
          </button>
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-x-auto">
        {loading ? (
          <div className="p-4">Loading…</div>
        ) : (
          <table className="w-full text-sm">
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
              {data.items?.map(it => (
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
            <tfoot>
              <tr className="bg-gray-100 font-semibold">
                <td className="p-2 text-left" colSpan={5}>Overall Total</td>
                <td className="p-2 text-center">{Peso(data.overall_total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
