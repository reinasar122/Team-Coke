import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { successStyle, errorStyle } from "../utils/toastStyles";
import PermissionTable from "../components/roles/PermissionTable";
import { MODULES } from "../components/roles/constants/modules";
import api from "../api"; // ✅ your Axios instance

const EditRoleAccess = ({ roleId, onClose, onRoleUpdated }) => {
  const [roleName, setRoleName] = useState("");
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  // ✅ Fetch role + permissions from backend using axios
  useEffect(() => {
    const fetchRoleAndPermissions = async () => {
      try {
        const [roleRes, accessRes] = await Promise.all([
          api.get(`/roles/${roleId}/`),
          api.get(`/role-access/?role_id=${roleId}`),
        ]);

        const roleData = roleRes.data;
        const accessData = accessRes.data; // your backend should return an object or list

        setRoleName(roleData.name);

        const permMap = {};
        Object.values(MODULES).flat().forEach((submenu) => {
          const found = accessData[submenu]; // object keyed by submenu
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
      } catch (error) {
        console.error("Error loading role access:", error);
        toast.error("Failed to load role or permissions.", { style: errorStyle });
      } finally {
        setLoading(false);
      }
    };

    fetchRoleAndPermissions();
  }, [roleId]);

  // Toggle individual permission
  const handleToggle = (submenu, type) => {
    setPermissions((prev) => ({
      ...prev,
      [submenu]: { ...prev[submenu], [type]: !prev[submenu][type] },
    }));
  };

  // Toggle full access (select all)
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

  // ✅ Save using your axios instance
  const handleSave = async () => {
    const hasSelectedPermission = Object.values(permissions).some((perms) =>
      ["full_access", "view", "create", "edit", "delete"].some(
        (key) => !!perms?.[key]
      )
    );

    if (!hasSelectedPermission) {
      return;
    }

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
      const res = await api.put("/role-access/bulk-upsert/", payload);

      if (res.status >= 200 && res.status < 300) {
        toast.success(`Permissions for role '${roleName}' updated successfully!`, { style: successStyle });

        // Dispatch notifications (optional)
        const roleEvent = new CustomEvent("rolePermissionsUpdated", {
          detail: {
            action: "updated",
            roleId,
            roleName,
            permissions,
            timestamp: new Date().toISOString(),
          },
        });
        window.dispatchEvent(roleEvent);

        if (onRoleUpdated) onRoleUpdated(roleId, roleName, permissions);
        onClose?.();
      } else {
        throw new Error("Bulk upsert failed");
      }
    } catch (error) {
      console.error("Error saving permissions:", error);
      toast.error("Failed to update permissions. Please try again.", { style: errorStyle });
    }
  };

  if (loading)
    return (
      <div className="text-center p-6 bg-white rounded shadow">
        Loading role access...
      </div>
    );

  const hasSelectedPermission = Object.values(permissions).some((perms) =>
    ["full_access", "view", "create", "edit", "delete"].some(
      (key) => !!perms?.[key]
    )
  );

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
        <button className="px-4 py-2 btn btn-cancel" onClick={onClose}>
          Cancel
        </button>
        <button
          className={`px-6 py-2 btn btn-primary ${
            !hasSelectedPermission ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={handleSave}
          disabled={!hasSelectedPermission}
          type="button"
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default EditRoleAccess;

