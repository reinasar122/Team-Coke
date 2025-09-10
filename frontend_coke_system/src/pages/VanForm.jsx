import { useState, useEffect } from "react";

const VanForm = ({ vanToEdit, onVanAdded, onClose }) => {
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

    // Get current warehouse from localStorage
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    
    // Determine which warehouse to use
    let warehouseId;
    if (user.role?.toLowerCase() === "admin" && selectedWarehouse) {
      warehouseId = selectedWarehouse.id;
    } else if (user.warehouse_id) {
      warehouseId = user.warehouse_id;
    } else {
      console.error("No warehouse found for user");
      alert("Error: No warehouse assigned to user");
      return;
    }

    const method = vanToEdit ? "PUT" : "POST";
    const url = vanToEdit
      ? `http://127.0.0.1:8080/api/vans/${vanToEdit.id}/`
      : `http://127.0.0.1:8080/api/vans/`;

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          van_id: vanId,
          plate_number: plateNumber,
          warehouse: warehouseId, // Include warehouse ID
        }),
      });

      if (!response.ok) throw new Error("Failed to save van");

      const newVan = await response.json();
      onVanAdded(newVan);
      onClose();
    } catch (error) {
      console.error("Error saving van:", error);
      alert("Error saving van: " + error.message);
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