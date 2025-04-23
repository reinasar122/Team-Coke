import { useState } from "react";

const MODULES = {
  "Sales Report": ["Dashboard"],
  "Inventory": ["Stocks", "Stock Adjustment"],
  "Transactions": ["Receiving", "Trading", "Invoice"],
  "Manage": ["User", "Roles", "Supplier", "Warehouse"],
};

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
    ["Dashboard", "Stocks", "Stock Adjustment", "User", "Roles", "Supplier", "Warehouse"].forEach((submenu) => {
      permissions[submenu] = { full_access: false, view: true, create: false, edit: false, delete: false };
    });
    ["Receiving", "Trading", "Invoice"].forEach((submenu) => {
      permissions[submenu] = { full_access: true, view: true, create: true, edit: true, delete: true };
    });
  } else if (role === "Cashier") {
    permissions["Stocks"] = { full_access: false, view: true, create: false, edit: false, delete: false };
    permissions["Supplier"] = { full_access: false, view: true, create: false, edit: false, delete: false };
    ["Receiving", "Trading", "Invoice"].forEach((submenu) => {
      permissions[submenu] = { full_access: true, view: true, create: true, edit: true, delete: true };
    });
  }

  return permissions;
};

const RoleForm = ({ onRoleAdded, onClose }) => {
  const [roleName, setRoleName] = useState("Admin");
  const [permissions, setPermissions] = useState(initializePermissions("Admin"));

  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    setRoleName(newRole);
    setPermissions(initializePermissions(newRole));
  };

  const handleFullAccessToggle = (submenu) => {
    setPermissions((prev) => ({
      ...prev,
      [submenu]: prev[submenu].full_access
        ? { full_access: false, view: false, create: false, edit: false, delete: false }
        : { full_access: true, view: true, create: true, edit: true, delete: true },
    }));
  };

  const togglePermission = (submenu, permission) => {
    setPermissions((prev) => ({
      ...prev,
      [submenu]: { ...prev[submenu], [permission]: !prev[submenu][permission] },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://127.0.0.1:8080/api/roles/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roleName, permissions }),
      });

      if (!response.ok) throw new Error("Failed to create role");

      const newRole = await response.json();
      onRoleAdded(newRole);
      onClose();
    } catch (error) {
      console.error("Error creating role:", error);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-4xl w-full">
        <h2 className="text-2xl font-bold mb-4">Role Accessibility Form</h2>

        {/* Role Type Selector */}
        <div className="mb-4">
          <label className="block font-medium mb-2">Role Type:</label>
          <select
            className="border p-2 w-full rounded"
            value={roleName}
            onChange={handleRoleChange}
          >
            <option value="Admin">Admin</option>
            <option value="Supervisor">Supervisor</option>
            <option value="Cashier">Cashier</option>
          </select>
        </div>

        {/* Permissions Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-200">
                <th className="border px-4 py-2">Menu</th>
                <th className="border px-4 py-2">Submenu</th>
                <th className="border px-4 py-2">Full Access</th>
                <th className="border px-4 py-2">View</th>
                <th className="border px-4 py-2">Create</th>
                <th className="border px-4 py-2">Edit</th>
                <th className="border px-4 py-2">Delete</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(MODULES).map(([menu, submenus]) =>
                submenus.map((submenu, index) => (
                  <tr key={submenu} className="text-center">
                    {index === 0 && (
                      <td rowSpan={submenus.length} className="border px-4 py-2 font-semibold bg-gray-100">
                        {menu}
                      </td>
                    )}
                    <td className="border px-4 py-2 font-medium">{submenu}</td>
                    <td className="border px-4 py-2">
                      <input
                        type="checkbox"
                        checked={permissions[submenu]?.full_access || false}
                        onChange={() => handleFullAccessToggle(submenu)}
                      />
                    </td>
                    {["view", "create", "edit", "delete"].map((perm) => (
                      <td key={perm} className="border px-4 py-2">
                        <input
                          type="checkbox"
                          checked={permissions[submenu]?.[perm] || false}
                          onChange={() => togglePermission(submenu, perm)}
                          disabled={permissions[submenu]?.full_access}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end mt-4 gap-2">
          <button className="bg-gray-500 text-white px-4 py-2 rounded" onClick={onClose}>
            Cancel
          </button>
          <button
            className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
            onClick={handleSubmit}
          >
            Save Permissions
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleForm;