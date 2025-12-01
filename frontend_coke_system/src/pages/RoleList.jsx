import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { errorStyle } from "../utils/toastStyles";
import RoleForm from "./RoleForm";
import EditRoleAccess from "./EditRoleAccess";
import { FaEdit, FaTrash, FaUserShield } from "react-icons/fa";
import api from "../api"; // ✅ correct
import { canCreate, canEdit, canDelete } from "../utils/accessControl"; // ✅ NEW

const RoleList = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isRoleFormVisible, setIsRoleFormVisible] = useState(false);
  const [showEditAccessModal, setShowEditAccessModal] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState(null);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);

  // Optional: compute summaries for badges
  const [roleSummaries, setRoleSummaries] = useState({}); // { [id]: 'Full'|'View-only'|'Custom' }

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/roles/");
      setRoles(data);

      // Fetch access lists for summaries (best-effort; ignore errors)
      try {
        const results = await Promise.all(
          data.map((r) =>
            fetch(`/role-access/?role_id=${r.id}`)
              .then((res) => (res.ok ? res.json() : null))
              .catch(() => null)
          )
        );

        const map = {};
        data.forEach((role, idx) => {
          const obj = results[idx]; // object or null
          if (!obj || Object.keys(obj).length === 0) {
            map[role.id] =
              role.name?.toLowerCase() === "admin" ? "Full" : "Custom";
          } else {
            const perms = Object.values(obj); // [{full, view, create, edit, delete}, ...]
            const allFull = perms.every((p) => p.full === true);
            const allViewOnly = perms.every(
              (p) =>
                p.view === true &&
                !p.create &&
                !p.edit &&
                !p.delete &&
                !p.full
            );
            map[role.id] = allFull ? "Full" : allViewOnly ? "View-only" : "Custom";
          }
        });
        setRoleSummaries(map);
      } catch {
        // ignore summary errors
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
    // Refresh summaries for new role
    setTimeout(fetchRoles, 0);
  };

  const confirmDelete = (role) => {
    setRoleToDelete(role);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!roleToDelete) return;
    try {
      await api.delete(`/roles/${roleToDelete.id}/`);

      setRoles((prev) => prev.filter((r) => r.id !== roleToDelete.id));

      toast.error(`Role '${roleToDelete.name}' has been deleted.`, {
        style: errorStyle,
      });

      const roleEvent = new CustomEvent("rolePermissionsUpdated", {
        detail: {
          action: "deleted",
          roleId: roleToDelete.id,
          roleName: roleToDelete.name,
          timestamp: new Date().toISOString(),
          summary: `Role '${roleToDelete.name}' deleted and all associated permissions removed`,
        },
      });
      window.dispatchEvent(roleEvent);
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

  // Handle role access updates from EditRoleAccess component
  const handleRoleAccessUpdated = (roleId, roleName, updatedPermissions) => {
    fetchRoles();

    const roleEvent = new CustomEvent("rolePermissionsUpdated", {
      detail: {
        action: "updated",
        roleId: roleId,
        roleName: roleName,
        permissions: updatedPermissions,
        timestamp: new Date().toISOString(),
        summary: `Role '${roleName}' permissions updated`,
        permissionsCount: updatedPermissions
          ? Object.keys(updatedPermissions).length
          : 0,
      },
    });
    window.dispatchEvent(roleEvent);
  };

  const isProtected = (role) => role.name?.toLowerCase() === "admin";

  return (
    <div className="page">
      <div className="flex justify-between items-center mb-6">
        {/* Left side: Icon + Title */}
        <div className="flex items-center gap-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FaUserShield className="color: var(--text)" /> Roles
          </h2>
        </div>

        {/* Right side: Create button with access control */}
        <button
          onClick={() => {
            if (canCreate("Roles")) setIsRoleFormVisible(true);
          }}
          className={`btn ${canCreate("Roles") ? "btn-add" : "btn-disabled"}`}
          disabled={!canCreate("Roles")}
        >
          + Create Role
        </button>
      </div>

      <div className="table-wrapper bg-white shadow-md rounded-lg">
        <table className="table table-hover">
          <thead>
            <tr>
              <th className="px-4 py-3 w-1/4">ROLE NAME</th>
              <th className="px-4 py-3 w-1/2">SUMMARY</th>
              <th className="px-4 py-3 w-1/4">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(4)].map((_, i) => (
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
            ) : roles.length > 0 ? (
              roles.map((role) => (
                <tr key={role.id}>
                  <td className="px-4 py-2">{role.name}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded-full ${(roleSummaries[role.id] || "Custom") === "Full"
                          ? "bg-green-100 text-green-700"
                          : (roleSummaries[role.id] || "Custom") ===
                            "View-only"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                    >
                      {roleSummaries[role.id] || "Custom"}
                    </span>
                  </td>
                  <td className="px-3 py-2 space-x-2">
                    <div className="inline-flex justify-end items-center gap-3">
                      {/* Edit Access button with access control */}
                      <button
                        onClick={() => {
                          if (canEdit("Roles")) handleEditAccess(role.id);
                        }}
                        className={`icon-btn ${canEdit("Roles")
                            ? "icon-btn-edit"
                            : "icon-btn-disabled"
                          }`}
                        title={
                          canEdit("Roles")
                            ? "Edit Access"
                            : "No permission to edit roles"
                        }
                        disabled={!canEdit("Roles")}
                      >
                        <FaEdit size={20} />
                      </button>

                      {/* Delete button with access control + Admin protection */}
                      <button
                        onClick={() => {
                          if (canDelete("Roles") && !isProtected(role)) {
                            confirmDelete(role);
                          }
                        }}
                        className={
                          !canDelete("Roles") || isProtected(role)
                            ? "icon-btn-disabled"
                            : "icon-btn-danger"
                        }
                        title={
                          isProtected(role)
                            ? "This role is protected"
                            : canDelete("Roles")
                              ? "Delete Role"
                              : "No permission to delete roles"
                        }
                        disabled={!canDelete("Roles") || isProtected(role)}
                      >
                        <FaTrash size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3">No roles found</td>
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
          <div className="bg-white rounded-lg shadow-lg w-[90%] md:w-[60%] max-h-[90vh] overflow-auto p-6">
            <EditRoleAccess
              roleId={selectedRoleId}
              onClose={() => setShowEditAccessModal(false)}
              onRoleUpdated={handleRoleAccessUpdated}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && roleToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 px-4">
          <div className="bg-white p-6 rounded shadow-lg max-w-full w-auto max
          -h-[90vh] overflow-auto">
            <p className="text-lg font-semibold mb-2">
              Are you sure you want to delete{" "}
              <strong>{roleToDelete.name}</strong>?
            </p>
            <p className="text-sm text-red-600 mb-6">
              This action cannot be undone.
            </p>
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
    </div>
  );
};

export default RoleList;