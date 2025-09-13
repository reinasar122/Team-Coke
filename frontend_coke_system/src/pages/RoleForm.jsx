import { useState } from "react";
import { toast } from "react-toastify";
import { successStyle, errorStyle } from "../utils/toastStyles";
import PermissionTable from "../components/roles/PermissionTable";
import { MODULES } from "../components/roles/constants/modules";

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

    setSaving(true);
    try {
      const roleRes = await fetch("http://127.0.0.1:8080/api/roles/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (roleRes.status === 400 || roleRes.status === 409) {
        let msg = `Role "${trimmed}" already exists.`;
        try {
          const errJson = await roleRes.json();
          const normalized = normalizeError(errJson, "Role already exists.");
          // Force final format: Role "<name>" already exists.
          if (/exists/i.test(normalized)) {
            msg = `Role "${trimmed}" already exists.`;
          } else {
            msg = `Role "${trimmed}" ${normalized}`;
          }
        } catch (_) {
          // keep default msg
        }

        toast.dismiss();
        toast.error(dedupeMessage(msg), { style: errorStyle });

        onClose?.(); 
        setSaving(false);
        return;
      }

      if (!roleRes.ok) {
        toast.dismiss();
        toast.error("Failed to create role.", { style: errorStyle });
        setSaving(false);
        return;
      }

      const newRole = await roleRes.json();

      const accessList = Object.entries(permissions).map(([submenu, perms]) => ({
        role: newRole.id,
        submenu,
        full: perms.full_access,
        view: perms.view,
        create: perms.create,
        edit: perms.edit,
        delete: perms.delete,
      }));

      const accessRes = await fetch("http://127.0.0.1:8080/api/role-access/bulk-create/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accessList),
      });

      if (!accessRes.ok) {
        toast.dismiss();
        toast.error("Permissions were not saved. Please try again.", { style: errorStyle });
        setSaving(false);
        return;
      }

      toast.dismiss();
      toast.success(`Role '${newRole.name}' has been created successfully!`, { style: successStyle });
      onRoleAdded?.(newRole);
      onClose?.();
    } catch (error) {
      console.error("Error saving role or permissions:", error);
      toast.dismiss();
      toast.error("Could not save role. Please try again.", { style: errorStyle });
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
            className="px-6 py-2 btn btn-primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Permissions"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleForm;