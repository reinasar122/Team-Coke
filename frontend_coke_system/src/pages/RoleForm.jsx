import { useState } from "react";

const MODULES = {
  "Sales Report": ["Dashboard"],
  Inventory: ["Stocks", "Stock Adjustment"],
  Transactions: ["Receiving", "Trading", "Invoice"],
  Manage: ["User", "Roles", "Supplier", "Warehouse"],
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
    [
      "Dashboard",
      "Stocks",
      "Stock Adjustment",
      "User",
      "Roles",
      "Supplier",
      "Warehouse",
    ].forEach((submenu) => {
      permissions[submenu] = {
        full_access: false,
        view: true,
        create: false,
        edit: false,
        delete: false,
      };
    });
    ["Receiving", "Trading", "Invoice"].forEach((submenu) => {
      permissions[submenu] = {
        full_access: true,
        view: true,
        create: true,
        edit: true,
        delete: true,
      };
    });
  } else if (role === "Cashier") {
    permissions["Stocks"] = {
      full_access: false,
      view: true,
      create: false,
      edit: false,
      delete: false,
    };
    permissions["Supplier"] = {
      full_access: false,
      view: true,
      create: false,
      edit: false,
      delete: false,
    };
    ["Receiving", "Trading", "Invoice"].forEach((submenu) => {
      permissions[submenu] = {
        full_access: true,
        view: true,
        create: true,
        edit: true,
        delete: true,
      };
    });
  }

  // Agent: default permissions remain unchecked
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
      [submenu]: {
        ...prev[submenu],
        [permission]: !prev[submenu][permission],
      },
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
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-8 rounded-xl shadow-xl max-w-6xl w-full">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">
          🎯 Role Accessibility Settings
        </h2>

        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">
            Select Role Type:
          </label>
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

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-300 rounded-md">
            <thead className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">Menu</th>
                <th className="px-4 py-2 text-left">Submenu</th>
                <th className="px-4 py-2 text-center">Full</th>
                <th className="px-4 py-2 text-center">View</th>
                <th className="px-4 py-2 text-center">Create</th>
                <th className="px-4 py-2 text-center">Edit</th>
                <th className="px-4 py-2 text-center">Delete</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(MODULES).map(([menu, submenus]) =>
                submenus.map((submenu, index) => (
                  <tr
                    key={submenu}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    {index === 0 && (
                      <td
                        rowSpan={submenus.length}
                        className="px-4 py-2 font-semibold border-r border-gray-300 align-top"
                      >
                        {menu}
                      </td>
                    )}
                    <td className="px-4 py-2 font-medium">{submenu}</td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={permissions[submenu]?.full_access}
                        onChange={() => handleFullAccessToggle(submenu)}
                      />
                    </td>
                    {["view", "create", "edit", "delete"].map((perm) => (
                      <td key={perm} className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={permissions[submenu]?.[perm]}
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

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-6 py-2 bg-purple-600 text-white font-semibold rounded hover:bg-purple-700"
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