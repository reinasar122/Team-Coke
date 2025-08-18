import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { errorStyle } from "../utils/toastStyles"
import RoleForm from "./RoleForm";
import EditRoleAccess from "./EditRoleAccess";
import { FaEdit, FaTrash } from "react-icons/fa";

const RoleList = () => {
  const [roles, setRoles] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRoleFormVisible, setIsRoleFormVisible] = useState(false);
  const [showEditAccessModal, setShowEditAccessModal] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState(null);

  // New states for delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);

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

  // Trigger delete modal instead of immediate delete
  const confirmDelete = (role) => {
    setRoleToDelete(role);
    setShowDeleteModal(true);
  };

  // Actual delete function
  const handleDelete = async () => {
  if (!roleToDelete) return;
  try {
    const response = await fetch(`http://127.0.0.1:8080/api/roles/${roleToDelete.id}/`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete role");

    setRoles((prev) => prev.filter((r) => r.id !== roleToDelete.id));
    toast.error(`Role '${roleToDelete.name}' has been deleted.`, {style: errorStyle});
  } catch (error) {
    console.error("Error deleting role:", error);
    toast.error("Error deleting role.", errorStyle);
  } finally {
    setShowDeleteModal(false);
    setRoleToDelete(null);
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
          className="bg-green-500 text-white px-4 py-2 rounded-lg"
        >
          + Create Role
        </button>
      </div>

      <div className="overflow-x-auto w-full bg-white shadow-md rounded-lg">
        <table className="w-full border-collapse">
          <thead className="bg-gray-200">
            <tr>
              <th className="py-3 px-4 text-left">ROLE NAME</th>
              <th className="py-3 px-7 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredRoles.length > 0 ? (
              filteredRoles.map((role) => (
                <tr key={role.id} className="border-t hover:bg-gray-100">
                  <td className="py-3 px-4 text-left">{role.name}</td>
                  <td className="py-3 px-7 text-right">
                    <div className="flex justify-end items-center gap-3">
                      <button
                        onClick={() => handleEditAccess(role.id)}
                        className="text-blue-500"
                        title="Edit Access"
                      >
                        <FaEdit size={20} />
                      </button>
                      <button
                        onClick={() => confirmDelete(role)}
                        className="text-red-500"
                        title="Delete Role"
                      >
                        <FaTrash size={20} />
                      </button>
                    </div>
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && roleToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 px-4">
          <div className="bg-white p-6 rounded shadow-lg max-w-full w-auto max-h-[90vh] overflow-auto">
            <p className="text-lg font-semibold mb-6">
              Are you sure you want to delete <strong>{roleToDelete.name}</strong>?
            </p>
            <div className="flex justify-between">
              <button
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                onClick={() => {
                  setShowDeleteModal(false);
                  setRoleToDelete(null);
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleList;