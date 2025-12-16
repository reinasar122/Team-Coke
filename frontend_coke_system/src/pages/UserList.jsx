import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { errorStyle } from "../utils/toastStyles";
import UserForm from "./UserForm";
import EditUser from "./EditUser";
import { canCreate, canEdit, canDelete } from "../utils/accessControl";
import { FaEdit, FaTrash, FaUsers } from "react-icons/fa";
import api from "../api"; // ✅ correct

// Search Icon Component
const SearchIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    style={{
      position: "absolute",
      left: "12px",
      top: "50%",
      transform: "translateY(-50%)",
      width: "20px",
      height: "20px",
      color: "var(--text-muted)",
    }}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M8.5 3a5.5 5.5 0 104.34 9.156l3.685 3.685a1 1 0 101.414-1.414l-3.685-3.685A5.5 5.5 0 008.5 3zM5 8.5a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z"
      clipRule="evenodd"
    />
  </svg>
);

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
    <div className="modal-overlay">
      <div className="modal">
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
              Save & Approve
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
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-body">
          <h3 className="page-title">Confirm Delete</h3>
          <p>
            Are you sure you want to delete user "{user?.first_name}{" "}
            {user?.last_name}"?
          </p>
          <p className="text-sm text-red-600 mb-6">
            This action cannot be undone.
          </p>
          <div className="flex justify-between">
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchWarehouses(); // Karen Changes
  }, []);

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

  const uniqueRoles = ["All Users", ...roles.map((role) => role.name)];

  const filteredUsers = users
    .filter(
      (user) =>
        (selectedRole === "All Users" || user.role?.name === selectedRole) &&
        (user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.last_name.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => a.first_name.localeCompare(b.first_name));

  return (
    <div className="page">
      {/* Compact Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          padding: "0 1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {/* Users Icon + Role dropdown */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "none",
                border: "none",
                fontSize: "1.1rem",
                fontWeight: 600,
                cursor: "pointer",
                color: "var(--text)",
                padding: "8px 12px",
                borderRadius: "var(--r-sm)",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.target.style.background = "var(--ghost-hover)")
              }
              onMouseLeave={(e) => (e.target.style.background = "none")}
            >
              <FaUsers style={{ fontSize: "1.2rem" }} />
              {selectedRole}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                style={{ width: "16px", height: "16px" }}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {dropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: "100%",
                  marginTop: "4px",
                  width: "180px",
                  background: "var(--surface)",
                  boxShadow: "var(--shadow)",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--border)",
                  zIndex: 10,
                }}
              >
                {uniqueRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      setSelectedRole(role);
                      setDropdownOpen(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                    }}
                    onMouseEnter={(e) =>
                      (e.target.style.background = "var(--ghost-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.target.style.background = "transparent")
                    }
                  >
                    {role}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search input */}
          <div style={{ position: "relative" }}>
            {!isFocused && <SearchIcon />}
            <input
              type="text"
              placeholder="Search a name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(searchTerm.length > 0)}
              className="input"
              style={{
                paddingLeft: isFocused ? "12px" : "40px",
                width: "250px",
                textAlign: "left",
              }}
            />
          </div>
        </div>

        {/* <button
          className={`btn ${canCreate("User") ? "btn-add" : "btn-disabled"}`}
          onClick={() => {
            if (canCreate("User")) setShowForm(true);
          }}
          disabled={!canCreate("User")}
        >
          + Create User
        </button> */}
      </div>

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
              <th className="text-left">ROLE</th>
              <th className="text-left">WAREHOUSE</th>
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
              filteredUsers.map((user) => (
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
                  <td className="text-left">{user.role?.name || "—"}</td>
                  <td className="text-left">{user.warehouse?.name || "—"}</td>

                  <td style={{ textAlign: "center" }}>
                    {user.status === "Pending Approval" || (!user.is_active && !user.is_approved) ? (
                      <button
                        onClick={() => handleUserApprovalClick(user)}
                        className="btn btn-primary"
                      >
                        Approve
                      </button>
                    ) : user.is_active ? (
                      <span
                        style={{
                          background: "#dcfce7",
                          color: "#16a34a",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          fontSize: "0.875rem",
                          fontWeight: 500,
                        }}
                      >
                        Active
                      </span>
                    ) : (
                      <span
                        style={{
                          background: "#fee2e2",
                          color: "#dc2626",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          fontSize: "0.875rem",
                          fontWeight: 500,
                        }}
                      >
                        Inactive
                      </span>
                    )}
                  </td>

                  <td>
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showForm && (
        <div className="modal-overlay">
          <UserForm
            onUserAdded={(newUser) => setUsers([...users, newUser])}
            onClose={() => setShowForm(false)}
          />
        </div>
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