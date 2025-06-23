import React, { useState, useEffect } from "react";
import { FaTrash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { canCreate, canEdit, canDelete, canView } from "../utils/accessControl";

const Warehouses = () => {
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8080/api/warehouses/");
        const data = await response.json();
        setWarehouses(data);
      } catch (error) {
        console.error("Error fetching warehouses:", error);
      }
    };

    fetchWarehouses();
  }, []);

  const deleteWarehouse = async (id) => {
    try {
      await fetch(`http://127.0.0.1:8080/api/warehouses/${id}/`, {
        method: "DELETE",
      });
      setWarehouses((prev) => prev.filter((warehouse) => warehouse.id !== id));
    } catch (error) {
      console.error("Error deleting warehouse:", error);
    }
  };

  // ❌ Block page if no view access
  if (!canView("Warehouse")) {
    return <div className="p-6 text-red-500 font-semibold">🚫 You do not have permission to view warehouses.</div>;
  }

  return (
    <div className="grid">
      <div className="p-6 flex-wrap w-100">
        <div className="grid">
          <button
            className={`py-2 mb-4 rounded col-end-12 ${
              canCreate("Warehouse") ? "bg-green-500 text-white hover:bg-green-600" : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
            onClick={() => canCreate("Warehouse") && navigate("/warehouseForm")}
            disabled={!canCreate("Warehouse")}
          >
            + New Warehouse
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {warehouses.map((warehouse) => (
            <div key={warehouse.id} className="bg-white shadow-lg p-4 rounded">
              <h2 className="font-bold text-lg">{warehouse.name}</h2>
              <p className="font-bold">{warehouse.street}</p>
              <p>{warehouse.city}, {warehouse.country}, {warehouse.zip_code}</p>
              <p>{warehouse.phone_number}</p>
              <p>{warehouse.email}</p>
              <div className="flex flex-nowrap justify-end items-stretch">
                <button
                  className={`px-3 py-1 rounded mt-2 ${
                    canEdit("Warehouse") ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                  onClick={() => canEdit("Warehouse") && navigate(`/editWarehouse/${warehouse.id}`)}
                  disabled={!canEdit("Warehouse")}
                >
                  Edit
                </button>

                <button
                  className={`px-2 py-2 rounded mt-2 ml-2 flex items-center gap-2 ${
                    canDelete("Warehouse") ? "bg-red-500 text-white hover:bg-red-600" : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                  onClick={() => canDelete("Warehouse") && deleteWarehouse(warehouse.id)}
                  disabled={!canDelete("Warehouse")}
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Warehouses;
