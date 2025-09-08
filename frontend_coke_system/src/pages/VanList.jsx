import { useState, useEffect } from "react";
import { FaSearch, FaEdit, FaTrash, FaTruck } from "react-icons/fa";
import { toast } from "react-toastify";
import VanForm from "./VanForm";
import { errorStyle, successStyle } from "../utils/toastStyles";
import "../styles/pages/vanlist.scss";

const VanList = () => {
  const [vans, setVans] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isVanFormVisible, setIsVanFormVisible] = useState(false);
  const [editingVan, setEditingVan] = useState(null);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);

  // ---------------------------
  // Lifecycle
  // ---------------------------
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

  // ---------------------------
  // Warehouse Helpers
  // ---------------------------
  const getCurrentWarehouse = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");

    if (user.role?.toLowerCase() === "admin" && selectedWarehouse) {
      setCurrentWarehouse(selectedWarehouse);
    } else if (user.warehouse_id) {
      setCurrentWarehouse({ id: user.warehouse_id, name: user.warehouse });
    }
  };

  // ---------------------------
  // Fetch Vans
  // ---------------------------
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

      const response = await fetch(`http://127.0.0.1:8080/api/vans/?warehouse=${warehouseId}`);
      if (!response.ok) throw new Error("Failed to fetch vans");

      const data = await response.json();
      setVans(data);
    } catch (error) {
      console.error("Error fetching vans:", error);
    }
  };

  // ---------------------------
  // Handlers
  // ---------------------------
  const handleVanAdded = (newVan) => {
    const exists = vans.find((v) => v.id === newVan.id);

    if (exists) {
      setVans((prev) => prev.map((v) => (v.id === newVan.id ? newVan : v)));
      toast.success(
        `Van '${newVan.plate_number}' has been updated successfully!`,
        { style: successStyle }
      );
    } else {
      setVans((prev) => [...prev, newVan]);
      toast.success(
        `Van '${newVan.plate_number}' has been added successfully!`,
        { style: successStyle }
      );
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
          <button class="confirm-btn px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded">Confirm</button>
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
        const response = await fetch(`http://127.0.0.1:8080/api/vans/${id}/`, {
          method: "DELETE",
        });

        if (!response.ok) throw new Error("Failed to delete van");

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

  return (
    <div className="page">

      <div className="flex justify-between items-center mb-6">
        {/* Title + Search */}
        <div  className="flex items-center gap-6">
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
          onClick={() => {
            setEditingVan(null);
            setIsVanFormVisible(true);
          }}
          className="px-4 py-2 btn btn-add">
          + Add Van
        </button>
      </div>

      {/* Vans Table */}
      <div className="table table-wrapper">
        <table className="table">
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
                    <button
                      onClick={() => handleEdit(van)}
                      className="icon-btn-edit "
                      title="Edit Van"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => handleDelete(van.id)}
                      className="icon-btn-danger"
                      title="Delete Van"
                    >
                      <FaTrash />
                    </button>
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

      {/* Van Form */}
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