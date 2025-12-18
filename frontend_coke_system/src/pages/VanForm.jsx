// VanForm.jsx - INTEGRATED VERSION WITH INCREMENTAL VAN ID (Van-XXX format)
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { successStyle, errorStyle } from "../utils/toastStyles";
import api from "../api";

const VanForm = ({ vanToEdit, onVanAdded, onClose }) => {
  const [vanId, setVanId] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [loading, setLoading] = useState(false);

  // Generate next incremental van_id
  const generateNextVanId = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");

      let warehouseId;
      if (user.role?.toLowerCase() === "admin" && selectedWarehouse) {
        warehouseId = selectedWarehouse.id;
      } else if (user.warehouse_id) {
        warehouseId = user.warehouse_id;
      } else {
        return "Van-001";
      }

      // Fetch existing vans to find the highest van_id
      const { data: existingVans } = await api.get(`/vans/?warehouse=${warehouseId}`);
      
      if (existingVans.length === 0) {
        return "Van-001";
      }

      // Extract numeric part from van_ids and find the maximum
      const vanNumbers = existingVans
        .map(van => {
          const match = van.van_id.match(/Van-(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(num => !isNaN(num));

      const maxNumber = Math.max(0, ...vanNumbers);
      const nextNumber = maxNumber + 1;
      
      // Format as Van-001, Van-002, etc.
      return `Van-${nextNumber.toString().padStart(3, '0')}`;
    } catch (error) {
      console.error("Error generating van ID:", error);
      return "Van-001";
    }
  };

  useEffect(() => {
    const initializeForm = async () => {
      if (vanToEdit) {
        // Editing existing van
        setVanId(vanToEdit.van_id);
        setPlateNumber(vanToEdit.plate_number);
      } else {
        // Creating new van - generate incremental ID
        setLoading(true);
        const nextVanId = await generateNextVanId();
        setVanId(nextVanId);
        setLoading(false);
      }
    };

    initializeForm();
  }, [vanToEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");

    let warehouseId;
    if (user.role?.toLowerCase() === "admin" && selectedWarehouse) {
      warehouseId = selectedWarehouse.id;
    } else if (user.warehouse_id) {
      warehouseId = user.warehouse_id;
    } else {
      toast.error("No warehouse assigned to user", { style: errorStyle });
      return;
    }

    const payload = {
      van_id: vanId.trim(),
      plate_number: plateNumber.trim(),
      warehouse: warehouseId,
    };

    try {
      let res;
      if (vanToEdit) {
        res = await api.put(`/vans/${vanToEdit.id}/`, payload);
      } else {
        res = await api.post(`/vans/`, payload);
      }

      const newVan = res.data;
      toast.success(
        `Van '${newVan.plate_number}' ${vanToEdit ? "updated" : "registered"} successfully!`,
        { style: successStyle }
      );

      onVanAdded?.(newVan);
      onClose?.();
    } catch (error) {
      if (error.response?.data) {
        const data = error.response.data;
        if (data.plate_number) {
          toast.error(`Plate Number: ${data.plate_number[0]}`, { style: errorStyle });
        } else if (data.van_id) {
          toast.error(`Van ID: ${data.van_id[0]}`, { style: errorStyle });
        } else {
          toast.error("Failed to save van.", { style: errorStyle });
        }
      } else {
        toast.error("Error saving van.", { style: errorStyle });
      }
      console.error("Save van error:", error);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay bg-black bg-opacity-50">
        <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3">Generating Van ID...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {vanToEdit ? "Edit Van" : "Add Van"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 font-medium">Van ID:</label>
            <input
              type="text"
              className="w-full border p-2 rounded text-base bg-gray-100"
              value={vanId}
              onChange={(e) => setVanId(e.target.value)}
              readOnly={!vanToEdit} // Read-only for new vans, editable for existing
              title={!vanToEdit ? "Auto-generated incremental ID" : "You can edit this van ID"}
              required
            />
            {!vanToEdit && (
              <p className="text-sm text-gray-600 mt-1">
                * Auto-generated incremental ID (Van-001, Van-002, etc.)
              </p>
            )}
          </div>

          <div>
            <label className="block mb-1 font-medium">Plate Number:</label>
            <input
              type="text"
              className="w-full border p-2 rounded text-base"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              placeholder="Enter plate number"
              required
            />
          </div>

          <div className="md:col-span-2 flex justify-end gap-2 mt-4">
            <button
              type="button"
              className="px-6 py-2 btn btn-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 btn btn-primary"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VanForm;