import { useState, useEffect } from "react";
import { toast } from "react-toastify"; // Import toast for notifications
import { successStyle, errorStyle } from "../utils/toastStyles"; // Import custom styles

const EditUser = ({ userId, onClose, onUserUpdated }) => {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8080/api/users/${userId}/`);
        const data = await response.json();
        setUser({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          gender: data.gender || "",
          username: data.username || "",
          phone_number: data.phone_number || "",
          role_id: data.role?.id || data.role_id || "",
          warehouse_id: data.warehouse?.id || data.warehouse_id || "",
          is_active: data.is_active ?? true,
        });
      } catch (err) {
        console.error("Failed to load user:", err);
      }
    };

    const fetchRoles = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8080/api/roles/");
        const data = await res.json();
        setRoles(data);
      } catch (err) {
        console.error("Failed to load roles:", err);
      }
    };

    const fetchWarehouses = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8080/api/warehouses/");
        const data = await res.json();
        setWarehouses(data);
      } catch (err) {
        console.error("Failed to load warehouses:", err);
      }
    };

    fetchUser();
    fetchRoles();
    fetchWarehouses();
  }, [userId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUser((prevUser) => ({
      ...prevUser,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updatedUser = {
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        gender: user.gender,
        phone_number: user.phone_number,
        role: parseInt(user.role_id),
        warehouse: parseInt(user.warehouse_id),
        is_active: user.is_active === "true" || user.is_active === true,
      };

      const res = await fetch(`http://127.0.0.1:8080/api/users/${userId}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedUser),
      });

      if (!res.ok) throw new Error("Update failed");

      const result = await res.json();
      onUserUpdated(result);
      onClose();

      // Success Toast with the user's name
      toast.success(`User ${user.first_name} ${user.last_name} updated successfully!`, {
        style: successStyle,
      });
    } catch (err) {
      console.error("Error updating user:", err);
      
      // Error Toast
      toast.error("Failed to update user. Please check the fields and try again.", {
        style: errorStyle,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div>Loading user data...</div>;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
      <div className="w-full max-w-3xl p-8 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-semibold mb-4 text-center">Edit User</h2>

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
                className="w-full border p-2 rounded"
                required
              />
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
                <option value="">Select Role</option>
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
                <option value="">Select Warehouse</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Username & Password */}
          <div className="mb-5 flex gap-6">
            <div className="w-1/2">
              <label className="block font-medium">Username</label>
              <input
                type="text"
                name="username"
                value={user.username}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                required
              />
            </div>
            <div className="w-1/2">
              <label className="block font-medium">Password</label>
              <input
                type="password"
                name="password"
                className="w-full border p-2 rounded"
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Status */}
          <div className="mb-5">
            <label className="block font-medium">Status:</label>
            <select
              name="is_active"
              value={user.is_active.toString()}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          {/* Buttons */}
          <div className="flex justify-between">
            <button type="button" onClick={onClose} className="bg-red-500 text-white py-2 px-4 rounded">
              Cancel
            </button>
            <button type="submit" className="bg-blue-500 text-white py-2 px-4 rounded" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUser;