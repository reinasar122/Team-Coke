import { useState, useEffect } from "react";
import RoleForm from "./RoleForm";

const RoleList = () => {
  const [roles, setRoles] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRoleFormVisible, setIsRoleFormVisible] = useState(false);
  const [editingRole, setEditingRole] = useState(null);

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
      setRoles((prevRoles) =>
        prevRoles.map((r) => (r.id === newRole.id ? newRole : r))
      );
    } else {
      setRoles((prevRoles) => [...prevRoles, newRole]);
    }

    setIsRoleFormVisible(false);
    setEditingRole(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this role?")) return;
    try {
      const response = await fetch(`http://127.0.0.1:8080/api/roles/${id}/`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete role");

      setRoles((prevRoles) => prevRoles.filter((r) => r.id !== id));
    } catch (error) {
      console.error("Error deleting role:", error);
    }
  };

  const handleEdit = (role) => {
    setEditingRole(role);
    setIsRoleFormVisible(true);
  };

  const filteredRoles = roles.filter((role) =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-4 sm:mb-0">
          <input
            type="text"
            placeholder="Search role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-4 pr-6 py-2 border rounded-lg bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 w-60"
          />
        </div>

        <button
          onClick={() => {
            setEditingRole(null);
            setIsRoleFormVisible(true);
          }}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
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
                      onClick={() => handleEdit(role)}
                      className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(role.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
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
          roleToEdit={editingRole}
          onRoleAdded={handleRoleAdded}
          onClose={() => {
            setIsRoleFormVisible(false);
            setEditingRole(null);
          }}
        />
      )}
    </div>
  );
};

export default RoleList;