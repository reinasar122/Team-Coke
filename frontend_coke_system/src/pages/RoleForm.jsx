import { useState } from "react";
import { toast } from "react-toastify";
import { successStyle, errorStyle } from "../utils/toastStyles";
import PermissionTable from "../components/roles/PermissionTable";
import { MODULES } from "../components/roles/constants/modules";
import api from "../api"; // ✅ correct

const normalizeError = (err, fallback = "Role already exists.") => {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err.detail) return String(err.detail);
  if (Array.isArray(err.name) && err.name.length) return String(err.name[0]);
  if (typeof err.name === "string") return err.name;

  try {
    const firstKey = Object.keys(err)[0];
    if (firstKey) {
      const v = err[firstKey];
      if (Array.isArray(v) && v.length) return String(v[0]);
      if (typeof v === "string") return v;
    }
  } catch (_) {}

  return fallback;
};

const dedupeMessage = (msg) =>
  (msg || "")
    .replace(/\.\s*$/, "") 
    .replace(/\s+/g, " ") + ".";

const PERMISSION_KEYS = ["full_access", "view", "create", "edit", "delete"];

const hasAnySelectedPermission = (permissions) =>
  Object.values(permissions || {}).some((perms) =>
    PERMISSION_KEYS.some((key) => !!perms?.[key])
  );

const initializePermissions = (role) => {
  const permissions = {};
  Object.values(MODULES).flat().forEach((submenu) => {
    permissions[submenu] = {
      full_access: false,
      view: false,
      create: false,
      edit: false,
      delete: false,
    };
  });

  if (role === "Admin") {
    Object.keys(permissions).forEach((submenu) => {
      permissions[submenu] = {
        full_access: true,
        view: true,
        create: true,
        edit: true,
        delete: true,
      };
    });
  } else if (role === "Supervisor") {
    [
      "Dashboard",
      "Stocks",
      "Product",
      "Returned Empties",
      "Sales Report",
      "Inventory Report",
      "User",
      "Roles",
      "Supplier",
      "Warehouse",
      "Van",
    ].forEach((submenu) => {
      permissions[submenu] = {
        full_access: false,
        view: true,
        create: false,
        edit: false,
        delete: false,
      };
    });
    ["Receiving", "Trading", "Supplier Return","Product", "Credit", "Expenses", "Settings"].forEach((submenu) => {
      permissions[submenu] = {
        full_access: true,
        view: true,
        create: true,
        edit: true,
        delete: true,
      };
    });
  } else if (role === "Cashier") {
    ["Stocks", "Product", "Returned Empties", "Settings"].forEach((submenu) => {
      permissions[submenu] = {
        full_access: false,
        view: true,
        create: false,
        edit: false,
        delete: false,
      };
    });
    permissions["Supplier"] = {
      full_access: false,
      view: true,
      create: false,
      edit: false,
      delete: false,
    };
    ["Receiving", "Trading"].forEach((submenu) => {
      permissions[submenu] = {
        full_access: true,
        view: true,
        create: true,
        edit: true,
        delete: true,
      };
    });
  }

  return permissions;
};

const RoleForm = ({ onRoleAdded, onClose }) => {
  const [roleName, setRoleName] = useState("Admin");
  const [permissions, setPermissions] = useState(initializePermissions("Admin"));
  const [saving, setSaving] = useState(false);
  const hasSelectedPermission = hasAnySelectedPermission(permissions);

  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    setRoleName(newRole);
    setPermissions(initializePermissions(newRole));
  };

  const handleFullAccessToggle = (submenu) => {
    setPermissions((prev) => {
      const full = !prev[submenu].full_access;
      return {
        ...prev,
        [submenu]: {
          full_access: full,
          view: full,
          create: full,
          edit: full,
          delete: full,
        },
      };
    });
  };

  const togglePermission = (submenu, permission) => {
    setPermissions((prev) => ({
      ...prev,
      [submenu]: {
        ...prev[submenu],
        [permission]: !prev[submenu][permission],
      },
    }));
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  if (saving) return;

  const trimmed = (roleName || "").trim();
  if (!trimmed) {
    toast.dismiss();
    toast.error("Role name is required.", { style: errorStyle });
    return;
  }

  if (!hasAnySelectedPermission(permissions)) {
    toast.dismiss();
    toast.error("Select at least one permission before saving.", { style: errorStyle });
    return;
  }

  setSaving(true);
  try {
    // ✅ Create role
    const roleRes = await api.post("/roles/", { name: trimmed });
    const newRole = roleRes.data;

    // ✅ Create role-access entries
    const accessList = Object.entries(permissions).map(([submenu, perms]) => ({
      role: newRole.id,
      submenu,
      full: perms.full_access,
      view: perms.view,
      create: perms.create,
      edit: perms.edit,
      delete: perms.delete,
    }));

    await api.post("/role-access/bulk-create/", accessList);

    toast.dismiss();
    toast.success(`Role '${newRole.name}' has been created successfully!`, { style: successStyle });

    // ✅ Dispatch rolePermissionsUpdated event
    const roleEvent = new CustomEvent("rolePermissionsUpdated", {
      detail: {
        action: "created",
        roleId: newRole.id,
        roleName: newRole.name,
        permissions,
        timestamp: new Date().toISOString(),
        summary: `New role '${newRole.name}' created with permissions`,
        permissionsCount: Object.keys(permissions).length,
        fullAccessCount: Object.values(permissions).filter((p) => p.full_access).length,
      },
    });
    window.dispatchEvent(roleEvent);

    onRoleAdded?.(newRole);
    onClose?.();
  } catch (error) {
    console.error("Error saving role or permissions:", error);

    // ✅ Handle duplicate or other backend errors cleanly
    if (error.response?.data) {
      const msg = normalizeError(error.response.data, "Role already exists.");
      toast.error(dedupeMessage(msg), { style: errorStyle });
    } else {
      toast.error("Could not save role. Please try again.", { style: errorStyle });
    }
  } finally {
    setSaving(false);
  }
};


  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-8 rounded-xl shadow-xl max-w-6xl w-full role-modal-container">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">
          Role Accessibility Settings
        </h2>

        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">Select Role Type:</label>
          <select
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            value={roleName}
            onChange={handleRoleChange}
          >
            <option value="Admin">Admin</option>
            <option value="Supervisor">Supervisor</option>
            <option value="Cashier">Cashier</option>
            <option value="Agent">Agent</option>
          </select>
        </div>

        <div className="table-wrapper mb-6">
          <PermissionTable
            modules={MODULES}
            permissions={permissions}
            onFullToggle={handleFullAccessToggle}
            onToggle={togglePermission}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button className="px-4 py-2 btn btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`px-6 py-2 btn btn-primary ${
              !hasSelectedPermission ? "opacity-50 cursor-not-allowed" : ""
            }`}
            onClick={handleSubmit}
            disabled={saving || !hasSelectedPermission}
            type="button"
          >
            {saving ? "Saving..." : "Save Permissions"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleForm;
