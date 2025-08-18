import { useState, useEffect } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import VanForm from "./VanForm";
import { toast } from "react-toastify";
import { errorStyle, successStyle } from "../utils/toastStyles"; 
const VanList = () => {
  const [vans, setVans] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isVanFormVisible, setIsVanFormVisible] = useState(false);
  const [editingVan, setEditingVan] = useState(null);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);

  useEffect(() => {
    fetchVans();
    getCurrentWarehouse();

    // Listen for warehouse changes
    const handleWarehouseChange = () => {
      getCurrentWarehouse();
      fetchVans();
    };

    window.addEventListener("warehouseChanged", handleWarehouseChange);

    return () => {
      window.removeEventListener("warehouseChanged", handleWarehouseChange);
    };
  }, []);

  const getCurrentWarehouse = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");

    if (user.role?.toLowerCase() === "admin" && selectedWarehouse) {
      setCurrentWarehouse(selectedWarehouse);
    } else if (user.warehouse_id) {
      setCurrentWarehouse({ id: user.warehouse_id, name: user.warehouse });
    }
  };

  const fetchVans = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");

      // Determine which warehouse to filter by
      let warehouseId;
      if (user.role?.toLowerCase() === "admin" && selectedWarehouse) {
        warehouseId = selectedWarehouse.id;
      } else if (user.warehouse_id) {
        warehouseId = user.warehouse_id;
      } else {
        console.error("No warehouse found for user");
        return;
      }

      const response = await fetch(`http://127.0.0.1:8080/api/vans/?warehouse=${warehouseId}`);
      if (!response.ok) throw new Error("Failed to fetch vans");
      const data = await response.json();
      setVans(data);
    } catch (error) {
      console.error("Error fetching vans:", error);
    }
  };

  const handleVanAdded = (newVan) => {
    const exists = vans.find((v) => v.id === newVan.id);
    if (exists) {
      setVans((prev) => prev.map((v) => (v.id === newVan.id ? newVan : v)));
      toast.success(`Van '${newVan.plate_number}' has been updated successfully!`, { style: successStyle });
    } else {
      setVans((prev) => [...prev, newVan]);
      toast.success(`Van '${newVan.plate_number}' has been added successfully!`, { style: successStyle });
    }
    setIsVanFormVisible(false);
    setEditingVan(null);
  };

  const showConfirmDialog = (message, onConfirm) => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
        <p class="text-gray-700 dark:text-gray-300 mb-4">${message}</p>
        <div class="flex justify-end space-x-3">
          <button class="cancel-btn px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">Cancel</button>
          <button class="confirm-btn px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded">Confirm</button>
        </div>
      </div>
    `;

    modal.querySelector('.cancel-btn').onclick = () => modal.remove();
    modal.querySelector('.confirm-btn').onclick = () => {
      modal.remove();
      onConfirm();
    };

    document.body.appendChild(modal);
  };

  const handleDelete = async (id) => {
    showConfirmDialog("Are you sure you want to delete this van?", async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8080/api/vans/${id}/`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to delete van");
        setVans((prev) => prev.filter((v) => v.id !== id));
        toast.error(`Van has been deleted successfully.`, { style: errorStyle });
      } catch (error) {
        console.error("Error deleting van:", error);
        toast.error("Error deleting van.", { style: errorStyle });
      }
    });
  };

  const handleEdit = (van) => {
    setEditingVan(van);
    setIsVanFormVisible(true);
  };

  const filteredVans = vans.filter((van) =>
    van.plate_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6">
      {/* Warehouse Indicator */}
      {currentWarehouse && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <span className="font-medium">Current Warehouse:</span> {currentWarehouse.name}
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <input
          type="text"
          placeholder="Search plate number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-4 pr-6 py-2 border rounded-lg bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 w-60 mb-4 sm:mb-0 text-base"
        />

        <button
          onClick={() => {
            setEditingVan(null);
            setIsVanFormVisible(true);
          }}
          className="bg-green-500 text-white px-4 py-2 rounded-lg"
        >
          + Add Van
        </button>
      </div>

      <div className="overflow-x-auto w-full bg-white shadow-md rounded-lg">
        <table className="w-full border-collapse">
          <thead className="bg-gray-200 text-left">
            <tr>
              <th className="py-3 px-4">VAN ID</th>
              <th className="py-3 px-4">PLATE NUMBER</th>
              <th className="py-3 px-14 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredVans.length > 0 ? (
              filteredVans.map((van) => (
                <tr key={van.id} className="border-t hover:bg-gray-100">
                  <td className="py-3 px-4">{van.van_id}</td>
                  <td className="py-3 px-4">{van.plate_number}</td>
                  <td className="py-4 px-16 text-right space-x-3">
                    <button
                      onClick={() => handleEdit(van)}
                      className="text-blue-500"
                      title="Edit Van"
                    >
                      <FaEdit size={20} />
                    </button>
                    <button
                      onClick={() => handleDelete(van.id)}
                      className="text-red-500"
                      title="Delete Van"
                    >
                      <FaTrash size={20} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="py-6 text-center">
                  No vans found for this warehouse
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isVanFormVisible && (
        <VanForm
          vanToEdit={editingVan}
          onVanAdded={handleVanAdded}
          onClose={() => {
            setIsVanFormVisible(false);
            setEditingVan(null);
          }}
        />
      )}
    </div>
  );
};

export default VanList;