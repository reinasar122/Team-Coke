import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { errorStyle } from "../utils/toastStyles"
import { FaWarehouse, FaEdit, FaTrash } from "react-icons/fa";
import { canCreate, canEdit, canDelete, canView } from "../utils/accessControl";
import WarehouseForm from "./WarehouseForm";
import EditWarehouse from "./EditWarehouse";



const Warehouses = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editWarehouseId, setEditWarehouseId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [warehouseToDelete, setWarehouseToDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://127.0.0.1:8080/api/warehouses/");
      if (!response.ok) throw new Error("Failed to fetch warehouses.");
      const data = await response.json();
      setWarehouses(data);
    } catch (error) {
      setError(error.message);
    } finally {
      console.error("Error fetching warehouses:", error);
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await fetch(`http://127.0.0.1:8080/api/warehouses/${warehouseToDelete.id}/`, {
        method: "DELETE",
      });
      setWarehouses((prev) => prev.filter((w) => w.id !== warehouseToDelete.id));
      toast.error(`Warehouse '${warehouseToDelete.name}' has been deleted.`, { style: errorStyle, });
    } catch (error) {
      console.error("Error deleting warehouse:", error);
      toast.error("Failed to delete warehouse.", { style: errorStyle });
    } finally {
      setShowDeleteModal(false);
      setWarehouseToDelete(null);
    }
  };

  if (!canView("Warehouse")) {
    return <div className="p-6 text-red-500 font-semibold">🚫 You do not have permission to view warehouses.</div>;
  }

  return (
    <div className="relative p-6">
      <div className="flex justify-end mb-4">
        <button
          className={`px-5 py-2 rounded-lg shadow-md transition ${
            canCreate("Warehouse")
              ? "bg-green-500 hover:bg-green-600 text-white"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
          onClick={() => canCreate("Warehouse") && setShowCreateModal(true)}
          disabled={!canCreate("Warehouse")}
        >
          + New Warehouse
        </button>
      </div>

      {loading ? (
      <div className="text-center py-10 text-gray-400">
        <svg className="animate-spin h-8 w-8 mx-auto mb-2 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
        </svg>
        Loading warehouses...
      </div>
    ) : error ? (
      <div className="text-center py-10 text-red-500 font-semibold">
        {error}
      </div>
      //empty State
   ) : warehouses.length === 0 ? (
        <div className="text-center text-gray-500 py-10">
          No warehouses found. Click <span className="font-bold">+ New Warehouse</span> to add one.
          </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {warehouses.map((warehouse) => (
          <div key={warehouse.id} className="bg-white shadow-lg p-3 rounded-xl border-l-3 border-shadow-500 hover:shadow-xl transition"> 
           
              {/* Title */}
            <div className="flex items-center gap-2 mb-3">
                <FaWarehouse className="color: var(--text)" size={22} />
                <h2 className="font-bold text-xl">{warehouse.name}</h2>
              </div>

            {/* Address */}
            <p className="text-sm text-gray-600">{warehouse.street_address},{warehouse.barangay}, {warehouse.city}, {warehouse.province}, </p>

            <p className="text-sm text-gray-600">
              {warehouse.region}, {warehouse.country} {warehouse.zip_code}
            </p>

            {/* Contact */}
            <p className="text-sm text-gray-700">📞 {warehouse.phone_number}</p>
            <p className="text-sm text-gray-700">✉️ {warehouse.email}</p>

            {/*Edit Warehouse*/}
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => canEdit("Warehouse") && setEditWarehouseId(warehouse.id)}
                disabled={!canEdit("Warehouse")}
                title="Edit Warehouse"
                className="icon-btn" 
              >
                <FaEdit/> 
              </button>

            {/*Delete Warehouse*/}
              <button
                onClick={() => {  
                  if (canDelete("Warehouse")) {
                    setWarehouseToDelete(warehouse);
                    setShowDeleteModal(true);
                  }
                }}
                disabled={!canDelete("Warehouse")}
                title="Delete Warehouse"
                className={`icon-btn-danger`}
              >
                <FaTrash/>
              </button>
            </div>
          </div>
        ))}
      </div>
      )}
        
      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-lg">
            <WarehouseForm
              onClose={() => setShowCreateModal(false)}
              onSuccess={() => {
                fetchWarehouses();
                setShowCreateModal(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editWarehouseId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-lg">
            <EditWarehouse
              id={editWarehouseId}
              onClose={() => setEditWarehouseId(null)}
              onSuccess={() => {
                fetchWarehouses();
                setEditWarehouseId(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-full w-auto mx-4">
            <p className="text-lg font-semibold mb-6">
              Are you sure you want to delete <strong>{warehouseToDelete?.name}</strong>?
            </p>
            <div className="flex justify-between">
              <div>
                <button
                  className="btn-cancel py-2 px-4 rounded"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
              </div>
              <div>
                <button
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  onClick={handleDelete}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Warehouses;