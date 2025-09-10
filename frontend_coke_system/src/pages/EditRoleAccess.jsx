import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { successStyle, errorStyle } from "../utils/toastStyles";
import PermissionTable from "../components/roles/PermissionTable";
import { MODULES } from "../components/roles/constants/modules";

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

        if (!roleRes.ok) throw new Error("Failed to load role");
        if (!accessRes.ok) throw new Error("Failed to load access");

        const roleData = await roleRes.json();
        const accessData = await accessRes.json(); // <-- object keyed by submenu
        setRoleName(roleData.name);

        const permMap = {};
        Object.values(MODULES).flat().forEach((submenu) => {
          const found = accessData[submenu]; // <-- read directly by key
          permMap[submenu] = found
            ? {
                full_access: !!found.full,
                view: !!found.view,
                create: !!found.create,
                edit: !!found.edit,
                delete: !!found.delete,
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
      } catch (e) {
        console.error("Error loading role access:", e);
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
      const res = await fetch("http://127.0.0.1:8080/api/role-access/bulk-upsert/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Bulk upsert failed");

      toast.success(`✅ Permissions for role '${roleName}' updated successfully!`, { style: successStyle });
      onClose?.();
    } catch (error) {
      console.error("Error saving permissions:", error);
      toast.error("Failed to update permissions. Please try again.", { style: errorStyle });
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

      <div className="table-wrapper">
        <PermissionTable
          modules={MODULES}
          permissions={permissions}
          onFullToggle={handleFullToggle}
          onToggle={handleToggle}
          className="max-h-[70vh]"
        />
      </div>

      <div className="flex justify-end mt-6 gap-3">
        <button
          className="px-4 py-2 btn btn-cancel"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="px-6 py-2 btn btn-primary"
          onClick={handleSave}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default EditRoleAccess;