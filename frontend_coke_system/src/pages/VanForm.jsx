import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { successStyle, errorStyle } from "../utils/toastStyles";

const API = "http://127.0.0.1:8080/api";

const VanForm = ({ vanToEdit, onSuccess, onClose }) => {
  const [vanId, setVanId] = useState("");
  const [plateNumber, setPlateNumber] = useState("");

  useEffect(() => {
    if (vanToEdit) {
      setVanId(vanToEdit.van_id);
      setPlateNumber(vanToEdit.plate_number);
    }
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

    const method = vanToEdit ? "PUT" : "POST";
    const url = vanToEdit
      ? `${API}/vans/${vanToEdit.id}/`
      : `${API}/vans/`;

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.plate_number) {
          toast.error(`Plate Number: ${data.plate_number[0]}`, { style: errorStyle });
        } else {
          toast.error("Failed to save van.", { style: errorStyle });
        }
        return;
      }

      const newVan = await res.json();
      toast.success(
        `Van '${newVan.plate_number}' ${vanToEdit ? "updated" : "registered"} successfully!`,
        { style: successStyle }
      );

      onSuccess?.();
      onClose?.();
    } catch (error) {
      toast.error("Error saving van.", { style: errorStyle });
      console.error("Save van error:", error);
    }
  };

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
              className="w-full border p-2 rounded text-base"
              value={vanId}
              onChange={(e) => setVanId(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Plate Number:</label>
            <input
              type="text"
              className="w-full border p-2 rounded text-base"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-between items-center mt-6">
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
