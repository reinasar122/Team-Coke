import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { successStyle, errorStyle } from "../utils/toastStyles"; // Add error and success styles

const MODULES = {
  "Sales Report": ["Dashboard"],
  Transactions: ["Receiving", "Trading", "Supplier Return"],
  Inventory: ["Stocks", "Product", "Returned Empties"],
  Reports: ["Sales Report", "Inventory Report"],
  Manage: ["User", "Roles", "Supplier", "Warehouse", "Van"],
  Settings: ["Settings"],
};

const EditRoleAccess = ({ roleId, onClose }) => {
  const [roleName, setRoleName] = useState("");
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoleAndPermissions = async () => {
      try {
        const [roleRes, accessRes] = await Promise.all([
          fetch(`http://127.0.0.1:8080/api/roles/${roleId}/`),
          fetch(`http://127.0.0.1:8080/api/role-access/?role_id=${roleId}`),
        ]);

        const roleData = await roleRes.json();
        const accessData = await accessRes.json();
        setRoleName(roleData.name);

        // Build permission map
        const permMap = {};
        Object.values(MODULES).flat().forEach((submenu) => {
          const found = accessData.find((p) => p.submenu?.name === submenu);
          permMap[submenu] = found
            ? {
                full_access: found.full,
                view: found.view,
                create: found.create,
                edit: found.edit,
                delete: found.delete,
              }
            : {
                full_access: false,
                view: false,
                create: false,
                edit: false,
                delete: false,
              };
        });

        setPermissions(permMap);
        setLoading(false);
      } catch (error) {
        console.error("Error loading role access:", error);
        setLoading(false);
      }
    };

    fetchRoleAndPermissions();
  }, [roleId]);

  const handleToggle = (submenu, type) => {
    setPermissions((prev) => ({
      ...prev,
      [submenu]: {
        ...prev[submenu],
        [type]: !prev[submenu][type],
      },
    }));
  };

  const handleFullToggle = (submenu) => {
    const full = !permissions[submenu].full_access;
    setPermissions((prev) => ({
      ...prev,
      [submenu]: {
        full_access: full,
        view: full,
        create: full,
        edit: full,
        delete: full,
      },
    }));
  };

  const handleSave = async () => {
    const payload = Object.entries(permissions).map(([submenu, perms]) => ({
      role: roleId,
      submenu,
      full: perms.full_access,
      view: perms.view,
      create: perms.create,
      edit: perms.edit,
      delete: perms.delete,
    }));

    try {
      await fetch("http://127.0.0.1:8080/api/role-access/bulk-update/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      toast.success(`✅ Permissions for role '${roleName}' updated successfully!`, {
        style: successStyle,
      });
      onClose();
    } catch (error) {
      console.error("Error saving permissions:", error);
      toast.error("Failed to update permissions. Please try again.", {
        style: errorStyle,
      });
    }
  };

  if (loading) {
    return (
      <div className="text-center p-6 bg-white rounded shadow">
        Loading role access...
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">
        Edit Access for: <span className="text-blue-600">{roleName}</span>
      </h2>

      <div className="overflow-x-auto max-h-[70vh]">
        <table className="w-full table-auto border text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="text-left px-4 py-2">Menu</th>
              <th className="text-left px-4 py-2">Submenu</th>
              <th className="px-2">Full</th>
              <th className="px-2">View</th>
              <th className="px-2">Create</th>
              <th className="px-2">Edit</th>
              <th className="px-2">Delete</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(MODULES).map(([menu, submenus]) =>
              submenus.map((submenu, idx) => (
                <tr key={submenu} className={idx % 2 ? "bg-gray-50" : "bg-white"}>
                  {idx === 0 && (
                    <td
                      rowSpan={submenus.length}
                      className="font-semibold border-r px-4 py-2 align-top"
                    >
                      {menu}
                    </td>
                  )}
                  <td className="px-4 py-2">{submenu}</td>
                  {["full_access", "view", "create", "edit", "delete"].map((type) => (
                    <td key={type} className="text-center">
                      <input
                        type="checkbox"
                        checked={permissions[submenu]?.[type] || false}
                        onChange={() =>
                          type === "full_access"
                            ? handleFullToggle(submenu)
                            : handleToggle(submenu, type)
                        }
                        disabled={
                          type !== "full_access" &&
                          permissions[submenu]?.full_access
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mt-6 gap-3">
        <button
          className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700"
          onClick={handleSave}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default EditRoleAccess;