import { useState, useEffect } from "react";

const VanForm = ({ vanToEdit, onVanAdded, onClose }) => {
  const [vanId, setVanId] = useState("");
  const [plateNumber, setPlateNumber] = useState("");

  useEffect(() => {
    if (vanToEdit) {
      setVanId(vanToEdit.van_id);
      setPlateNumber(vanToEdit.plate_number); // ✅ Corrected from 'route' to 'plate_number'
    }
  }, [vanToEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();

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
          plate_number: plateNumber, // ✅ Corrected field name
        }),
      });

      if (!response.ok) throw new Error("Failed to save van");

      const newVan = await response.json();
      onVanAdded(newVan);
      onClose();
    } catch (error) {
      console.error("Error saving van:", error);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {vanToEdit ? "Edit Van" : "Add Van"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 font-medium">Van ID:</label>
            <input
              type="text"
              className="w-full border p-2 rounded"
              value={vanId}
              onChange={(e) => setVanId(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Plate Number:</label>
            <input
              type="text"
              className="w-full border p-2 rounded"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              className="bg-gray-400 text-white px-4 py-2 rounded"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
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
