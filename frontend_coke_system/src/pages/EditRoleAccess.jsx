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
  const [saving, setSaving] = useState(false);

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
    if (saving) return;

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
      setSaving(true);
      const res = await api.put("/role-access/bulk-upsert/", payload);

      if (res.status >= 200 && res.status < 300) {
        const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
        const normalizedRoleName = String(roleName || "").trim().toLowerCase();
        const currentUserRoleName = String(
          currentUser?.role_name ||
          currentUser?.role?.name ||
          currentUser?.role ||
          ""
        )
          .trim()
          .toLowerCase();
        const currentUserRoleId = Number(currentUser?.role_id || currentUser?.role?.id || 0);
        const editedRoleId = Number(roleId || 0);
        const isCurrentUsersRole =
          (editedRoleId > 0 && currentUserRoleId > 0 && editedRoleId === currentUserRoleId) ||
          (normalizedRoleName && normalizedRoleName === currentUserRoleName);

        if (isCurrentUsersRole) {
          localStorage.setItem("access", JSON.stringify(payload));
          window.dispatchEvent(
            new CustomEvent("accessPermissionsUpdated", {
              detail: {
                roleId: editedRoleId,
                roleName,
                access: payload,
                updatedAt: new Date().toISOString(),
              },
            })
          );
        }

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
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="text-center p-6 bg-white dark:bg-slate-900 rounded-xl shadow border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-100">
        Loading role access...
      </div>
    );

  const hasSelectedPermission = Object.values(permissions).some((perms) =>
    ["full_access", "view", "create", "edit", "delete"].some(
      (key) => !!perms?.[key]
    )
  );

  return (
    <div className="text-gray-900 dark:text-slate-100">
      <h2 className="text-xl font-bold mb-4">
        Edit Access for: <span className="text-blue-600 dark:text-cyan-300">{roleName}</span>
      </h2>

      <div className="table-wrapper rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <PermissionTable
          modules={MODULES}
          permissions={permissions}
          onFullToggle={handleFullToggle}
          onToggle={handleToggle}
          className="max-h-[70vh]"
        />
      </div>

      <div className="flex justify-end mt-6 gap-3 pt-1">
        <button className="px-4 py-2 btn btn-cancel" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button
          className={`px-6 py-2 btn btn-primary ${
            !hasSelectedPermission || saving ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={handleSave}
          disabled={!hasSelectedPermission || saving}
          type="button"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
};

export default EditRoleAccess;

