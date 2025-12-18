import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { successStyle, errorStyle } from "../utils/toastStyles";
import api from "../api"; // ✅ your Axios instance

const EditUser = ({ userId, onClose, onUserUpdated }) => {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [usernameManuallyChanged, setUsernameManuallyChanged] = useState(false); // Track if username was manually edited

  // ---------------- Fetch user, roles, warehouses ----------------
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await api.get("/roles/");  // Replaced fetch with api.get()
        setRoles(res.data);
      } catch (err) {
        console.error("Failed to load roles:", err);
      }
    };

    const fetchWarehouses = async () => {
      try {
        const res = await api.get("/warehouses/"); // Replaced fetch with api.get()
        setWarehouses(res.data);
      } catch (err) {
        console.error("Failed to load warehouses:", err);
      }
    };

    const fetchUser = async () => {
      try {
        const response = await api.get(`/users/${userId}/`); // Replaced fetch with api.get()
        const data = response.data;
        console.log("Fetched user:", data);

        let roleId = data.role?.id || data.role_id || "";
        let warehouseId = data.warehouse?.id || data.warehouse_id || "";

        // ✅ Check if username was manually set or should default to phone number
        const hasCustomUsername = data.username && data.username !== data.phone_number;
        
        setUser({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          gender: data.gender || "",
          username: data.username || data.phone_number || "", // ✅ Default to phone number if username is empty
          phone_number: data.phone_number || "",
          role_id: Number(roleId) || "",
          warehouse_id: Number(warehouseId) || "",
          is_active: data.is_active ?? true,
          password: "", // blank by default
        });

        // ✅ Set flag if username was manually customized
        setUsernameManuallyChanged(hasCustomUsername);
      } catch (err) {
        console.error("Failed to load user:", err);
      }
    };

    Promise.all([fetchRoles(), fetchWarehouses()]).then(fetchUser);
  }, [userId]);

  // ---------------- ✅ Phone Number Validation ----------------
  const validatePhoneNumber = (phone) => {
    if (!phone) return "Phone number is required.";
    if (!/^\d+$/.test(phone)) return "Phone number must contain only numbers.";
    if (phone.length !== 11) return "Phone number must be exactly 11 digits.";
    return null;
  };

  // ---------------- Handle Input Changes ----------------
  const handleChange = (e) => {
    const { name, value } = e.target;

    setUser((prev) => {
      const updated = {
        ...prev,
        [name]: name === "role_id" || name === "warehouse_id" ? Number(value) : value,
      };

      // ✅ Auto-sync username with phone number if it hasn't been manually changed
      if (name === "phone_number" && !usernameManuallyChanged) {
        updated.username = value;
      }

      return updated;
    });

    // ✅ Track if username was manually edited
    if (name === "username") {
      setUsernameManuallyChanged(true);
    }

    // Clear specific errors on input
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));

    // Real-time validation for phone number
    if (name === "phone_number") {
      const phoneError = validatePhoneNumber(value);
      if (phoneError) setErrors((prev) => ({ ...prev, phone_number: phoneError }));
    }
  };

  // ✅ Function to sync username with phone number
  const syncUsernameWithPhone = () => {
    setUser((prev) => ({
      ...prev,
      username: prev.phone_number
    }));
    setUsernameManuallyChanged(false);
    toast.success("Username synced with phone number!", { style: successStyle });
  };

  // ---------------- Handle Submit ----------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      // Validate phone number before sending
      const phoneError = validatePhoneNumber(user.phone_number);
      if (phoneError) {
        setErrors({ phone_number: phoneError });
        toast.error(phoneError, { style: errorStyle });
        return;
      }

      const updatedUser = {
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        gender: user.gender,
        phone_number: user.phone_number,
        role_id: Number(user.role_id),
        warehouse_id: Number(user.warehouse_id),
        is_active: user.is_active === "true" || user.is_active === true,
        password: user.password || undefined,
      };

      const res = await api.put(`/users/${userId}/`, updatedUser); // Replaced fetch with api.put()

      const result = res.data;

      if (!res.status === 200) {
        // Handle backend validation errors gracefully
        if (result.phone_number && result.phone_number[0]) {
          toast.error(`Phone number error: ${result.phone_number[0]}`, { style: errorStyle });
        } else if (result.username && result.username[0]) {
          toast.error(`Username error: ${result.username[0]}`, { style: errorStyle });
        } else {
          toast.error("Failed to update user. Please check all fields.", { style: errorStyle });
        }
        return;
      }

      // Success
      onUserUpdated(result);
      onClose();
      toast.success(
        `User ${user.first_name} ${user.last_name} updated successfully!`,
        { style: successStyle }
      );
    } catch (err) {
      console.error("Error updating user:", err);
      toast.error("Unexpected error. Please try again.", { style: errorStyle });
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Loading State ----------------
  if (!user || roles.length === 0 || warehouses.length === 0) {
    return <div>Loading user data...</div>;
  }

  // ---------------- JSX ----------------
  return (
    <div className="modal-overlay bg-gray-900 bg-opacity-50">
      <div className="w-full max-w-3xl p-8 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-semibold mb-4 text-left">Edit User</h2>

        <form onSubmit={handleSubmit}>
          {/* Name Fields */}
          <div className="mb-5 flex gap-6">
            <div className="w-1/2">
              <label className="block font-medium">First Name</label>
              <input
                type="text"
                name="first_name"
                value={user.first_name}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                required
              />
            </div>
            <div className="w-1/2">
              <label className="block font-medium">Last Name</label>
              <input
                type="text"
                name="last_name"
                value={user.last_name}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                required
              />
            </div>
          </div>

          {/* Gender & Phone */}
          <div className="mb-5 flex gap-6">
            <div className="w-1/2">
              <label className="block font-medium">Gender</label>
              <select
                name="gender"
                value={user.gender}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                required
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="w-1/2">
              <label className="block font-medium">Phone Number</label>
              <input
                type="text"
                name="phone_number"
                value={user.phone_number}
                onChange={handleChange}
                className={`w-full border p-2 rounded ${
                  errors.phone_number ? "border-red-500" : ""
                }`}
                required
                placeholder="e.g., 09123456789"
              />
              {errors.phone_number && (
                <p className="text-red-500 text-sm mt-1">{errors.phone_number}</p>
              )}
            </div>
          </div>

          {/* Role & Warehouse */}
          <div className="mb-5 flex gap-6">
            <div className="w-1/2">
              <label className="block font-medium">Role</label>
              <select
                name="role_id"
                value={user.role_id}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                required
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-1/2">
              <label className="block font-medium">Warehouse</label>
              <select
                name="warehouse_id"
                value={user.warehouse_id}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                required
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Username & Status */}
          <div className="mb-5 flex gap-6">
            {/* <div className="w-1/2">
              <label className="block font-medium">
                Username
                {usernameManuallyChanged && user.username !== user.phone_number && (
                  <span className="text-sm text-blue-600 ml-2">(Custom)</span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="username"
                  value={user.username}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                  required
                  placeholder="Username (defaults to phone number)"
                />
                ✅ Sync button - only show if username differs from phone number
                {user.username !== user.phone_number && (
                  <button
                    type="button"
                    onClick={syncUsernameWithPhone}
                    className="px-3 py-2 bg-blue-500 text-white rounded text-sm whitespace-nowrap hover:bg-blue-600 transition-colors"
                    title="Sync username with phone number"
                  >
                    Sync
                  </button>
                )}
              </div>
              {!usernameManuallyChanged && (
                <p className="text-gray-500 text-xs mt-1">
                  Username will automatically sync with phone number
                </p>
              )}
            </div> */}

            <div className="w-1/2">
              <label className="block font-medium">Status</label>
              <select
                name="is_active"
                value={user.is_active.toString()}
                onChange={handleChange}
                className="w-full border p-2 rounded"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          {/* Buttons */}
          <div className="md:col-span-2 flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-cancel py-2 px-4"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary py-2 px-4"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUser;