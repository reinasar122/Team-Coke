import { useState, useEffect } from "react";
import RoleForm from "./RoleForm";
import EditRoleAccess from "./EditRoleAccess";

const RoleList = () => {
  const [roles, setRoles] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRoleFormVisible, setIsRoleFormVisible] = useState(false);
  const [showEditAccessModal, setShowEditAccessModal] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState(null);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8080/api/roles/");
      if (!response.ok) throw new Error("Failed to fetch roles");
      const data = await response.json();
      setRoles(data);
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  const handleRoleAdded = (newRole) => {
    const exists = roles.find((r) => r.id === newRole.id);
    if (exists) {
      setRoles((prev) => prev.map((r) => (r.id === newRole.id ? newRole : r)));
    } else {
      setRoles((prev) => [...prev, newRole]);
    }
    setIsRoleFormVisible(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this role?")) return;
    try {
      const response = await fetch(`http://127.0.0.1:8080/api/roles/${id}/`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete role");
      setRoles((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      console.error("Error deleting role:", error);
    }
  };

  const handleEditAccess = (roleId) => {
    setSelectedRoleId(roleId);
    setShowEditAccessModal(true);
  };

  const filteredRoles = roles.filter((role) =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative container mx-auto p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <input
          type="text"
          placeholder="Search role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-4 pr-6 py-2 border rounded-lg bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 w-60 mb-4 sm:mb-0"
        />

        <button
          onClick={() => setIsRoleFormVisible(true)}
          className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
        >
          + Create Role
        </button>
      </div>

      <div className="overflow-x-auto w-full bg-white shadow-md rounded-lg">
        <table className="w-full border-collapse">
          <thead className="bg-gray-200 text-left">
            <tr>
              <th className="py-3 px-4">ROLE NAME</th>
              <th className="py-3 px-14 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredRoles.length > 0 ? (
              filteredRoles.map((role) => (
                <tr key={role.id} className="border-t hover:bg-gray-100">
                  <td className="py-3 px-4">{role.name}</td>
                  <td className="py-3 px-7 text-right space-x-2">
                    <button
                      onClick={() => handleEditAccess(role.id)}
                      className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Edit Access
                    </button>
                    <button
                      onClick={() => handleDelete(role.id)}
                      className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="2" className="py-6 text-center">
                  No roles found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isRoleFormVisible && (
        <RoleForm
          onRoleAdded={handleRoleAdded}
          onClose={() => setIsRoleFormVisible(false)}
        />
      )}

      {showEditAccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg w-[90%] md:w-[50%] max-h-[90vh] overflow-auto p-6">
            <EditRoleAccess
              roleId={selectedRoleId}
              onClose={() => setShowEditAccessModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleList;
