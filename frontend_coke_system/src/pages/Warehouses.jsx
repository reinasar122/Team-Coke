import React, { useState, useEffect } from "react";
import { FaTrash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const Warehouses = () => {
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState([]);

  // Fetch warehouses from backend
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

  // Delete a warehouse
  const deleteWarehouse = async (id) => {
    try {
      await fetch(`http://127.0.0.1:8080/api/warehouses/${id}/`, {
        method: "DELETE",
      });
      setWarehouses(warehouses.filter((warehouse) => warehouse.id !== id));
    } catch (error) {
      console.error("Error deleting warehouse:", error);
    }
  };

  return (
    <div className="grid ">
      <div className="p-6 flex-wrap w-100">
        <div className="grid">
          <button
            className="bg-green-500 text-white py-2 rounded col-end-12 mb-4"
            onClick={() => navigate("/warehouseForm")}
          >
            + New Warehouse
          </button>
        </div>

        {/* Warehouse List */}
        <div className="grid grid-cols-2 gap-6">
          {warehouses.map((warehouse) => (
            <div key={warehouse.id} className="bg-white shadow-lg p-4 rounded">
              <h2 className="font-bold text-lg">{warehouse.name}</h2>
              <p className="font-bold">{warehouse.street}</p>
              <p>{warehouse.city}, {warehouse.country}, {warehouse.zip_code}</p>
              <p>{warehouse.phone_number}</p>
              <p>{warehouse.email}</p>
              <div className="flex flex-nowrap justify-end items-stretch">
                <button className="bg-blue-500 text-white px-3 py-1 rounded mt-2"
                  onClick={() => navigate(`/editWarehouse/${warehouse.id}`)}>
                  Edit
                </button>
                <button className="bg-red-500 text-white px-2 py-2 rounded mt-2 ml-2 flex items-center gap-2"
                  onClick={() => deleteWarehouse(warehouse.id)}>
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
