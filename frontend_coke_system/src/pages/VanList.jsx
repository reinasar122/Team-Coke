import { useState, useEffect } from "react";
import { FaSearch, FaEdit, FaTrash, FaTruck } from "react-icons/fa";
import { toast } from "react-toastify";
import VanForm from "./VanForm";
import { errorStyle, successStyle } from "../utils/toastStyles";
import { canCreate, canEdit, canDelete, canView } from "../utils/accessControl";
import "../styles/pages/vanlist.scss";
import api from "../api";

const VanList = () => {
  const [vans, setVans] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isVanFormVisible, setIsVanFormVisible] = useState(false);
  const [editingVan, setEditingVan] = useState(null);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);

  useEffect(() => {
    fetchVans();
    getCurrentWarehouse();

    const handleWarehouseChange = () => {
      getCurrentWarehouse();
      fetchVans();
    };

    window.addEventListener("warehouseChanged", handleWarehouseChange);
    return () => window.removeEventListener("warehouseChanged", handleWarehouseChange);
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

      let warehouseId;
      if (user.role?.toLowerCase() === "admin" && selectedWarehouse) {
        warehouseId = selectedWarehouse.id;
      } else if (user.warehouse_id) {
        warehouseId = user.warehouse_id;
      } else {
        console.error("No warehouse found for user");
        return;
      }

      const { data } = await api.get(`/vans/?warehouse=${warehouseId}`);
      setVans(data);

    } catch (error) {
      console.error("Error fetching vans:", error);
    }
  };

  const handleVanAdded = (newVan) => {
    const exists = vans.find((v) => v.id === newVan.id);

    if (exists) {
      setVans((prev) => prev.map((v) => (v.id === newVan.id ? newVan : v)));
      toast.success(`Van '${newVan.plate_number}' has been updated successfully!`, {
        style: successStyle,
      });
    } else {
      setVans((prev) => [...prev, newVan]);
      toast.success(`Van '${newVan.plate_number}' has been added successfully!`, {
        style: successStyle,
      });
    }

    setIsVanFormVisible(false);
    setEditingVan(null);
  };

  const showConfirmDialog = (message, onConfirm) => {
    const modal = document.createElement("div");
    modal.className =
      "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";

    modal.innerHTML = `
      <div class="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
        <p class="text mb-4">${message}</p>
        <div class="flex justify-end space-x-3">
          <button class="cancel-btn px-4 py-2 text">Cancel</button>
          <button class="confirm-btn px-4 py-2 text-white">Delete</button>
        </div>
      </div>
    `;

    modal.querySelector(".cancel-btn").onclick = () => modal.remove();
    modal.querySelector(".confirm-btn").onclick = () => {
      modal.remove();
      onConfirm();
    };

    document.body.appendChild(modal);
  };

  const handleDelete = async (id) => {
    showConfirmDialog("Are you sure you want to delete this van?", async () => {
      try {
        await api.delete(`/vans/${id}/`);

        setVans((prev) => prev.filter((v) => v.id !== id));
        toast.error("Van has been deleted successfully.", { style: errorStyle });
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

  if (!canView("Van")) {
    return (
      <div className="p-6 text-red-500 font-semibold">
        🚫 You do not have permission to view vans.
      </div>
    );
  }

  return (
    <div className="page">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FaTruck className="color: var(--text)" /> Van Management
          </h2>

          <div className="relative w-72 mr-4">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search plate number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        {/* Add Van Button */}
        <button
          onClick={() => canCreate("Van") && setIsVanFormVisible(true)}
          disabled={!canCreate("Van")}
          className={`px-4 py-2 rounded-lg text-white font-semibold ${
            canCreate("Van")
              ? "bg-green-500 hover:bg-green-600 cursor-pointer"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          + Add Van
        </button>
      </div>

      <div className="table-wrapper bg-white shadow-md rounded-lg">
        <table className="table table-hover w-full">
          <thead>
            <tr>
              <th className="px-4 py-3 w-1/4">Van ID</th>
              <th className="px-4 py-3 w-1/2">Plate Number</th>
              <th className="px-4 py-3 w-1/4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredVans.length > 0 ? (
              filteredVans.map((van) => (
                <tr key={van.id} className="border-b">
                  <td className="px-4 py-2">{van.van_id}</td>
                  <td className="px-4 py-2">{van.plate_number}</td>
                  <td className="px-3 py-2 space-x-2">
                    <div className="inline-flex items-center gap-3">
                      <button
                        onClick={() => handleEdit(van)}
                        disabled={!canEdit("Van")}
                        className={canEdit("Van") ? "icon-btn-edit" : "icon-btn-disabled"}
                        title="Edit Van"
                      >
                        <FaEdit size={20} />
                      </button>

                      <button
                        onClick={() => handleDelete(van.id)}
                        disabled={!canDelete("Van")}
                        className={canDelete("Van") ? "icon-btn-danger" : "icon-btn-disabled"}
                        title="Delete Van"
                      >
                        <FaTrash size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="py-6 text text-center">
                  No vans found
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