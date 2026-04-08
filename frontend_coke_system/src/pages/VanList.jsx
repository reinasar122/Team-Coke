// VanList.jsx - INTEGRATED VERSION WITH API IMPROVEMENTS
import { useState, useEffect, useCallback } from "react";
import { FaEdit, FaTrash, FaTruck, FaWarehouse } from "react-icons/fa";
import { toast } from "react-toastify";
import VanForm from "./VanForm";
import { errorStyle, successStyle } from "../utils/toastStyles";
import { canCreate, canEdit, canDelete, canView } from "../utils/accessControl";
import { getCurrentWarehouse, findWarehouseByName } from '../utils/warehouseUtils';
import api from "../api";
import "../styles/pages/vanlist.scss";
import PageSearchToolbar from "../components/common/PageSearchToolbar";

const VanList = () => {
  const [vans, setVans] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isVanFormVisible, setIsVanFormVisible] = useState(false);
  const [editingVan, setEditingVan] = useState(null);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ KEPT: Proper warehouse setup using utilities (from old version)
  const setupWarehouse = useCallback(async () => {
    console.log('🏭 Setting up warehouse for VanList...');
    
    const warehouse = getCurrentWarehouse();
    
    if (!warehouse) {
      console.warn('⚠️ No warehouse found for user');
      setCurrentWarehouse(null);
      setLoading(false);
      return;
    }
    
    // If warehouse needs ID lookup, find it by name
    if (warehouse.needsIdLookup) {
      const foundWarehouse = await findWarehouseByName(warehouse.name);
      setCurrentWarehouse(foundWarehouse);
    } else {
      setCurrentWarehouse(warehouse);
    }
    
    setLoading(false);
  }, []);

  const fetchVans = useCallback(async () => {
    if (!currentWarehouse?.id) {
      console.warn('❌ No warehouse ID available for fetching vans');
      setVans([]);
      return;
    }

    try {
      console.log('🚐 Fetching vans for warehouse:', currentWarehouse);

      const { data } = await api.get(`/vans/?warehouse=${currentWarehouse.id}`);
      console.log(`✅ Loaded ${data.length} vans for warehouse ${currentWarehouse.name}`);
      setVans(data);
    } catch (error) {
      console.error("Error fetching vans:", error);
      setVans([]);
    }
  }, [currentWarehouse]);

  // ✅ KEPT: Setup warehouse first, then fetch vans (from old version)
  useEffect(() => {
    setupWarehouse();
  }, [setupWarehouse]);

  useEffect(() => {
    if (currentWarehouse?.id) {
      fetchVans();
    }
  }, [currentWarehouse, fetchVans]);

  // ✅ KEPT: Listen for warehouse changes (from old version)
  useEffect(() => {
    const handleWarehouseChange = (event) => {
      console.log('🏭 Warehouse change detected in VanList:', event.detail);
      setupWarehouse();
    };
    
    window.addEventListener("warehouseChanged", handleWarehouseChange);
    return () => window.removeEventListener("warehouseChanged", handleWarehouseChange);
  }, [setupWarehouse]);

  // ✅ FIXED: Removed duplicate success messages
  const handleVanAdded = (newVan) => {
    const exists = vans.find((v) => v.id === newVan.id);

    if (exists) {
      setVans((prev) => prev.map((v) => (v.id === newVan.id ? newVan : v)));
    } else {
      setVans((prev) => [...prev, newVan]);
    }

    setIsVanFormVisible(false);
    setEditingVan(null);
  };

  const showConfirmDialog = (message, onConfirm) => {
    const modal = document.createElement("div");
    modal.className = "app-modal-overlay z-50 px-4";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    modal.innerHTML = `
      <div class="app-modal-panel app-modal-panel-sm bg-white p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
        <p class="text mb-4 font-medium">${message}</p>
        <div class="flex justify-end space-x-3">
          <button class="cancel-btn btn btn-cancel px-4 py-2">Cancel</button>
          <button class="confirm-btn btn btn-danger px-4 py-2">Delete</button>
        </div>
      </div>
    `;

    const closeDialog = () => {
      window.removeEventListener("keydown", handleKeyDown);
      modal.remove();
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") closeDialog();
    };

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeDialog();
    });

    window.addEventListener("keydown", handleKeyDown);

    modal.querySelector(".cancel-btn").onclick = () => closeDialog();
    modal.querySelector(".confirm-btn").onclick = () => {
      closeDialog();
      onConfirm();
    };

    document.body.appendChild(modal);
    modal.querySelector(".cancel-btn")?.focus();
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

  // ✅ KEPT: Show loading state while setting up warehouse (from old version)
  if (loading && !currentWarehouse) {
    return (
      <div className="page">
        <div className="loading">
          <div className="spinner" />
          <div className="loading-text">Setting up warehouse...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <h2 className="page-title flex items-center gap-2">
            <FaTruck /> Van Management
          </h2>

          {currentWarehouse && (
            <span className="page-warehouse-chip">
              <span className="page-warehouse-chip__icon" aria-hidden="true"><FaWarehouse /></span>
              <span className="page-warehouse-chip__text">{currentWarehouse.name}</span>
            </span>
          )}
        </div>
      </div>

      <PageSearchToolbar
        value={searchTerm}
        onChange={setSearchTerm}
        onClear={() => setSearchTerm("")}
        placeholder="Search plate number..."
        actions={
          <button
            onClick={() => canCreate("Van") && setIsVanFormVisible(true)}
            disabled={!canCreate("Van") || !currentWarehouse?.id}
            className={`btn ${canCreate("Van") && currentWarehouse?.id ? "btn-add" : "btn-disabled"}`}
          >
            + Add Van
          </button>
        }
      />
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
                        <FaEdit size={16} />
                      </button>

                      <button
                        onClick={() => handleDelete(van.id)}
                        disabled={!canDelete("Van")}
                        className={canDelete("Van") ? "icon-btn-danger" : "icon-btn-disabled"}
                        title="Delete Van"
                      >
                        <FaTrash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="py-6 text text-center">
                  {/* ✅ KEPT: Better empty state message (from old version) */}
                  {currentWarehouse ? 
                    `No vans found for ${currentWarehouse.name}` : 
                    'No warehouse selected. Please select a warehouse to view vans.'
                  }
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


