import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { errorStyle } from "../utils/toastStyles";
import RoleForm from "./RoleForm";
import EditRoleAccess from "./EditRoleAccess";
import { canCreate, canEdit, canDelete } from "../utils/accessControl";
import { FaEdit, FaTrash, FaUserShield } from "react-icons/fa";

const RoleList = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRoleFormVisible, setIsRoleFormVisible] = useState(false);
  const [showEditAccessModal, setShowEditAccessModal] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [roleSummaries, setRoleSummaries] = useState({});

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://127.0.0.1:8080/api/roles/");
      if (!response.ok) throw new Error("Failed to fetch roles");
      const data = await response.json();
      setRoles(data);

      try {
        const results = await Promise.all(
          data.map((r) =>
            fetch(`http://127.0.0.1:8080/api/role-access/?role_id=${r.id}`)
              .then((res) => (res.ok ? res.json() : null))
              .catch(() => null)
          )
        );

        const map = {};
        data.forEach((role, idx) => {
          const obj = results[idx];
          if (!obj || Object.keys(obj).length === 0) {
            map[role.id] = role.name?.toLowerCase() === "admin" ? "Full" : "Custom";
          } else {
            const perms = Object.values(obj);
            const allFull = perms.every((p) => p.full === true);
            const allViewOnly = perms.every(
              (p) => p.view === true && !p.create && !p.edit && !p.delete && !p.full
            );
            map[role.id] = allFull ? "Full" : allViewOnly ? "View-only" : "Custom";
          }
        });
        setRoleSummaries(map);
      } catch {
        // ignore
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
      toast.error("Failed to load roles.", { style: errorStyle });
    } finally {
      setLoading(false);
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
    setTimeout(fetchRoles, 0);
  };

  const confirmDelete = (role) => {
    setRoleToDelete(role);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!roleToDelete) return;
    try {
      const response = await fetch(`http://127.0.0.1:8080/api/roles/${roleToDelete.id}/`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete role");
      setRoles((prev) => prev.filter((r) => r.id !== roleToDelete.id));
      toast.error(`Role '${roleToDelete.name}' has been deleted.`, { style: errorStyle });
    } catch (error) {
      console.error("Error deleting role:", error);
      toast.error("Error deleting role.", { style: errorStyle });
    } finally {
      setShowDeleteModal(false);
      setRoleToDelete(null);
    }
  };

  const handleEditAccess = (roleId) => {
    setSelectedRoleId(roleId);
    setShowEditAccessModal(true);
  };

  const isProtected = (role) => role.name?.toLowerCase() === "admin";

  return (
    <div className="page">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FaUserShield /> Roles
          </h2>
        </div>

        <button
          onClick={() => canCreate("User") && setIsRoleFormVisible(true)}
          disabled={!canCreate("User")}
          className={`px-4 py-2 rounded-lg text-white font-semibold ${
            canCreate("User")
              ? "bg-green-500 hover:bg-green-600 cursor-pointer"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          + Create Role
        </button>
      </div>

      <div className="table-wrapper bg-white shadow-md rounded-lg">
        <table className="table table-hover w-full">
          <thead>
            <tr>
              <th className="px-4 py-3 w-1/4">ROLE NAME</th>
              <th className="px-4 py-3 w-1/2">SUMMARY</th>
              <th className="px-4 py-3 w-1/4">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-t animate-pulse">
                    <td className="text-left">
                      <div className="h-4 w-32 bg-gray-200 rounded" />
                    </td>
                    <td>
                      <div className="h-4 w-24 bg-gray-200 rounded mx-auto" />
                    </td>
                    <td className="text-right">
                      <div className="h-4 w-16 bg-gray-200 rounded inline-block" />
                    </td>
                  </tr>
                ))
              : roles.length > 0
              ? roles.map((role) => (
                  <tr key={role.id}>
                    <td className="px-4 py-2">{role.name}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded-full ${
                          (roleSummaries[role.id] || "Custom") === "Full"
                            ? "bg-green-100 text-green-700"
                            : (roleSummaries[role.id] || "Custom") === "View-only"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {roleSummaries[role.id] || "Custom"}
                      </span>
                    </td>
                    <td className="px-3 py-2 space-x-2">
                      <div className="inline-flex justify-end items-center gap-3">
                        <button
                          onClick={() => handleEditAccess(role.id)}
                          disabled={!canEdit("User")}
                          className={`icon-btn ${
                            canEdit("User") ? "icon-btn-edit" : "icon-btn-disabled"
                          }`}
                          title="Edit Access"
                        >
                          <FaEdit size={20} />
                        </button>
                        <button
                          onClick={() => !isProtected(role) && confirmDelete(role)}
                          className={`icon-btn ${
                            isProtected(role)
                              ? "icon-btn-disabled"
                              : canDelete("User")
                              ? "icon-btn-danger"
                              : "icon-btn-disabled"
                          }`}
                          title={isProtected(role) ? "This role is protected" : "Delete Role"}
                          disabled={isProtected(role)}
                        >
                          <FaTrash size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              : (
                <tr>
                  <td colSpan="3">No roles found</td>
                </tr>
              )}
          </tbody>
        </table>
      </div>

      {isRoleFormVisible && (
        <RoleForm onRoleAdded={handleRoleAdded} onClose={() => setIsRoleFormVisible(false)} />
      )}

      {showEditAccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg w-[90%] md:w-[60%] max-h-[90vh] overflow-auto p-6">
            <EditRoleAccess roleId={selectedRoleId} onClose={() => setShowEditAccessModal(false)} />
          </div>
        </div>
      )}

      {showDeleteModal && roleToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 px-4">
          <div className="bg-white p-6 rounded shadow-lg max-w-full w-auto max-h-[90vh] overflow-auto">
            <p className="text-lg font-semibold mb-2">
              Are you sure you want to delete <strong>{roleToDelete.name}</strong>?
            </p>
            <p className="text-sm text-red-600 mb-6">This action cannot be undone.</p>
            <div className="flex justify-between">
              <button
                className="btn btn-cancel"
                onClick={() => {
                  setShowDeleteModal(false);
                  setRoleToDelete(null);
                }}
              >
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div> // <-- THIS closes the main <div className="page">
  );
};

export default RoleList;
