import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { errorStyle } from "../utils/toastStyles";
import UserForm from "./UserForm";
import EditUser from "./EditUser";
import { canCreate, canEdit, canDelete } from "../utils/accessControl";
import { FaEdit, FaTrash, FaUsers } from "react-icons/fa";
import api from "../api"; // ✅ correct
import PageSearchToolbar, { PageToolbarSelect } from "../components/common/PageSearchToolbar";

// Karen Changes: Approval Modal for assigning role + warehouse
const ApprovalModal = ({ isOpen, onClose, user, roles, warehouses, onApproved }) => {
  const [roleId, setRoleId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");

  useEffect(() => {
    if (user) {
      setRoleId(user.role?.id || "");
      setWarehouseId(user.warehouse?.id || "");
    } else {
      setRoleId("");
      setWarehouseId("");
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleSave = async () => {
    if (!roleId || !warehouseId) {
      toast.error("Please select both role and warehouse.");
      return;
    }

    try {
      const payload = {
        role: roleId,          // ✅ backend expects "role"
        warehouse: warehouseId, // ✅ backend expects "warehouse"
        is_approved: true,
        is_active: true,
        status: "Active",
      };

      const { data } = await api.patch(`/users/${user.id}/`, payload);

      toast.success(`User '${data.first_name} ${data.last_name}' approved.`);
      onApproved(data);
      onClose();
    } catch (error) {
      console.error("Error approving user:", error);
      toast.error("Failed to approve user.");
    }
  };


  return (
    <div className="modal-overlay app-modal-overlay" role="dialog" aria-modal="true">
      <div className="modal app-modal-panel app-modal-panel-sm">
        <div className="modal-body">
          <h3 className="page-title">Approve User</h3>
          <p style={{ marginBottom: "0.75rem" }}>
            Assign role and warehouse for:
          </p>
          <p style={{ fontWeight: 600, marginBottom: "1rem" }}>
            {user.first_name} {user.last_name}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <label className="label">Role</label>
              <select
                className="input"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                <option value="">Select role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Warehouse</label>
              <select
                className="input"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">Select warehouse</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-between" style={{ marginTop: "1.5rem" }}>
            <button type="button" className="btn btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, user }) => {
  if (!isOpen) return null;

  return (
    <div className="app-modal-overlay z-50 px-4" role="dialog" aria-modal="true">
      <div className="app-modal-panel app-modal-panel-sm p-6 w-full max-w-xl max-h-[90vh] overflow-auto">
        <div className="modal-body">
          <h3 className="page-title">Confirm Delete</h3>
          <p className="text-lg font-semibold mb-2">
            Are you sure you want to delete user "{user?.first_name}{" "}
            {user?.last_name}"?
          </p>
          <p className="text-sm text-red-600 mb-6">
            This action cannot be undone.
          </p>
          <div className="flex justify-end mt-6 gap-3">
            <button type="button" className="btn btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={onConfirm}>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [warehouses, setWarehouses] = useState([]); // Karen Changes
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, user: null });
  const [approvalModal, setApprovalModal] = useState({ open: false, user: null }); // Karen Changes
  const [selectedRole, setSelectedRole] = useState("All Users");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchWarehouses(); // Karen Changes
  }, []);

  useEffect(() => {
    const hasOpenModal = showForm || !!editingUser || deleteModal.open || approvalModal.open;
    if (!hasOpenModal) return undefined;

    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;

      if (deleteModal.open) {
        setDeleteModal({ open: false, user: null });
        return;
      }
      if (approvalModal.open) {
        setApprovalModal({ open: false, user: null });
        return;
      }
      if (editingUser) {
        setEditingUser(null);
        return;
      }
      if (showForm) {
        setShowForm(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showForm, editingUser, deleteModal.open, approvalModal.open]);

  const fetchUsers = async () => {
    try {
      const { data } = await api.get("/users/");
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchRoles = async () => {
    try {
      const { data } = await api.get("/roles/");
      setRoles(data);
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  // Karen Changes: fetch warehouses for selection in approval modal
  const fetchWarehouses = async () => {
    try {
      const { data } = await api.get("/warehouses/");
      setWarehouses(data);
    } catch (error) {
      console.error("Error fetching warehouses:", error);
    }
  };

  const handleUserUpdated = (updatedUser) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) => (user.id === updatedUser.id ? updatedUser : user))
    );
    setEditingUser(null);
  };

  const handleDeleteUser = async () => {
    if (!deleteModal.user) return;

    try {
      await api.delete(`/users/${deleteModal.user.id}/`);
      setUsers((prevUsers) =>
        prevUsers.filter((user) => user.id !== deleteModal.user.id)
      );
      setDeleteModal({ open: false, user: null });

      toast.error(
        `User '${deleteModal.user.username || deleteModal.user.first_name}' has been deleted.`,
        { style: errorStyle }
      );
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error(
        `Failed to delete user '${deleteModal.user.username || deleteModal.user.first_name
        }'.`,
        errorStyle
      );
    }
  };

  // Karen Changes: open approval modal instead of direct patch
  const handleUserApprovalClick = (user) => {
    setApprovalModal({ open: true, user });
  };

  // Karen Changes: when backend returns updated user after approval
  const handleUserApproved = (updatedUser) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
    );
  };

  const uniqueRoles = ["All Users", ...Array.from(new Set(roles.map((role) => role.name).filter(Boolean)))];

  const filteredUsers = users
    .filter(
      (user) =>
        (selectedRole === "All Users" || user.role?.name === selectedRole) &&
        (user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.last_name.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => a.first_name.localeCompare(b.first_name));

  const isPendingApproval = (user) =>
    user.status === "Pending Approval" || (!user.is_active && !user.is_approved);

  const getUserStatus = (user) => {
    if (user.is_active) {
      return {
        label: "Active",
        className: "app-status-pill app-status-pill--active",
      };
    }

    return {
      label: "Inactive",
      className: "app-status-pill app-status-pill--inactive",
    };
  };

  return (
    <div className="page">
      {/* Compact Header */}
      <div className="page-header">
        <div className="flex item-center gap-6">
          <h1 className="page-title flex items-center gap: 0.5rem">
            <FaUsers style={{ fontSize: "1.6rem" }} /> Users
          </h1>
        </div>
      </div>

      <PageSearchToolbar
        value={searchTerm}
        onChange={setSearchTerm}
        onClear={() => setSearchTerm("")}
        placeholder="Search a name..."
        controls={
          <PageToolbarSelect
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value)}
            ariaLabel="Filter users by role"
            options={uniqueRoles.map((role) => ({ value: role, label: role }))}
          />
        }
      />
      {/* Table */}
      <div className="table-wrapper">
        <table className="table table-hover" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "35%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "15%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className="text-left">USER DETAILS</th>
              <th style={{ textAlign: "center" }}>ROLE</th>
              <th style={{ textAlign: "center" }}>WAREHOUSE</th>
              <th style={{ textAlign: "center" }}>STATUS</th>
              <th style={{ textAlign: "center" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td
                  colSpan="5"
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "var(--text-muted)",
                  }}
                >
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const userStatus = getUserStatus(user);

                return (
                <tr key={user.id}>
                  <td className="text-left">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "50%",
                          border: "2px solid var(--text)",
                          background: "var(--bg)",
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          style={{
                            width: "24px",
                            height: "24px",
                            color: "var(--text)",
                          }}
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M12 2a5 5 0 015 5v1a5 5 0 01-10 0V7a5 5 0 015-5zm-7 17a7 7 0 0114 0v1a1 1 0 01-1 1H6a1 1 0 01-1-1v-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div>
                        <div
                          style={{ color: "var(--primary)", fontWeight: 500 }}
                        >
                          {user.first_name} {user.last_name}
                        </div>
                        <div
                          style={{
                            fontSize: "0.875rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* ✅ fixed role/warehouse display */}
                  <td style={{ textAlign: "center" }}>{user.role?.name || "—"}</td>
                  <td style={{ textAlign: "center" }}>{user.warehouse?.name || "—"}</td>

                  <td style={{ textAlign: "center" }}>
                    {isPendingApproval(user) ? (
                      <button
                        onClick={() => handleUserApprovalClick(user)}
                        className="btn app-status-pill app-status-pill--approve app-status-pill-btn"
                        title="Approve User"
                      >
                        Approve
                      </button>
                    ) : (
                      <span className={userStatus.className}>
                        {userStatus.label}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-2 space-x-2">
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        justifyContent: "center",
                      }}
                    >
                      <button
                        onClick={() => canEdit("User") && setEditingUser(user)}
                        disabled={!canEdit("User")}
                        className={`icon-btn ${canEdit("User")
                            ? "icon-btn-edit"
                            : "icon-btn-disabled"
                          }`}
                        title="Edit User"
                      >
                        <FaEdit size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (canDelete("User")) {
                            setDeleteModal({ open: true, user: user });
                          }
                        }}
                        disabled={!canDelete("User")}
                        className={`icon-btn ${canDelete("User")
                            ? "icon-btn-danger"
                            : "icon-btn-disabled"
                          }`}
                        title="Delete User"
                      >
                        <FaTrash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showForm && (
        <UserForm
          onUserAdded={(newUser) => setUsers([...users, newUser])}
          onClose={() => setShowForm(false)}
        />
      )}

      {editingUser && (
        <EditUser
          userId={editingUser.id}
          onUserUpdated={handleUserUpdated}
          onClose={() => setEditingUser(null)}
        />
      )}

      <DeleteConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, user: null })}
        onConfirm={handleDeleteUser}
        user={deleteModal.user}
      />

      {/* Karen Changes: Approval modal */}
      <ApprovalModal
        isOpen={approvalModal.open}
        onClose={() => setApprovalModal({ open: false, user: null })}
        user={approvalModal.user}
        roles={roles}
        warehouses={warehouses}
        onApproved={handleUserApproved}
      />
    </div>
  );
};

export default UserList;
