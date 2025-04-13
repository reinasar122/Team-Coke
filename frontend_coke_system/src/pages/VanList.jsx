import { useState, useEffect } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import VanForm from "./VanForm";

const VanList = () => {
  const [vans, setVans] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isVanFormVisible, setIsVanFormVisible] = useState(false);
  const [editingVan, setEditingVan] = useState(null);

  useEffect(() => {
    fetchVans();
  }, []);

  const fetchVans = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8080/api/vans/");
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
    } else {
      setVans((prev) => [...prev, newVan]);
    }
    setIsVanFormVisible(false);
    setEditingVan(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this van?")) return;
    try {
      const response = await fetch(`http://127.0.0.1:8080/api/vans/${id}/`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete van");
      setVans((prev) => prev.filter((v) => v.id !== id));
    } catch (error) {
      console.error("Error deleting van:", error);
    }
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
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <input
          type="text"
          placeholder="Search plate number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-4 pr-6 py-2 border rounded-lg bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 w-60 mb-4 sm:mb-0"
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
                  <td className="py-4 px-4 text-right space-x-3">
                    <button
                      onClick={() => handleEdit(van)}
                      className="text-blue-500"
                      title="Edit Van"
                    >
                      <FaEdit size={25} />
                    </button>
                    <button
                      onClick={() => handleDelete(van.id)}
                      className="text-red-500"
                      title="Delete Van"
                    >
                      <FaTrash size={25} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="py-6 text-center">
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
