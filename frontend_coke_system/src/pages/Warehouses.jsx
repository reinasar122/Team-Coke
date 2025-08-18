import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { errorStyle } from "../utils/toastStyles"
import { FaEdit, FaTrash } from "react-icons/fa";
import { canCreate, canEdit, canDelete, canView } from "../utils/accessControl";
import WarehouseForm from "./WarehouseForm";
import EditWarehouse from "./EditWarehouse";

const Warehouses = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editWarehouseId, setEditWarehouseId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [warehouseToDelete, setWarehouseToDelete] = useState(null);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8080/api/warehouses/");
      const data = await response.json();
      setWarehouses(data);
    } catch (error) {
      console.error("Error fetching warehouses:", error);
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
          className={`py-2 rounded w-fit ${
            canCreate("Warehouse")
              ? "bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
          onClick={() => canCreate("Warehouse") && setShowCreateModal(true)}
          disabled={!canCreate("Warehouse")}
        >
          + New Warehouse
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {warehouses.map((warehouse) => (
          <div key={warehouse.id} className="bg-white shadow-lg p-4 rounded">
            <h2 className="font-bold text-lg">{warehouse.name}</h2>
            <p className="text-sm">{warehouse.street_address},{warehouse.barangay}, {warehouse.city}, {warehouse.province}, </p>

            <p className="text-sm text-gray-700">
              {warehouse.region}, {warehouse.country} {warehouse.zip_code}
            </p>

            <p className="text-sm text-gray-700">{warehouse.phone_number}</p>
            <p className="text-sm text-gray-700">{warehouse.email}</p>

            <div className="flex justify-end gap-3 mt-2">
              <button
                onClick={() => canEdit("Warehouse") && setEditWarehouseId(warehouse.id)}
                disabled={!canEdit("Warehouse")}
                title="Edit Warehouse"
                className={`text-blue-500`}
              >
                <FaEdit size={20} />
              </button>
              <button
                onClick={() => {
                  if (canDelete("Warehouse")) {
                    setWarehouseToDelete(warehouse);
                    setShowDeleteModal(true);
                  }
                }}
                disabled={!canDelete("Warehouse")}
                title="Delete Warehouse"
                className={`text-red-500`}
              >
                <FaTrash size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>

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
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
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