import { useState, useEffect } from "react";

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
          role_id: data.role?.id || "",           // select value
          warehouse_id: data.warehouse?.id || "", // select value
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
    setUser((prevUser) => ({ ...prevUser, [name]: value }));
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
        is_active: user.is_active === "true",
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
    } catch (err) {
      console.error("Error updating user:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div>Loading user data...</div>;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-4 text-center">Edit User</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField label="First Name" name="first_name" value={user.first_name} onChange={handleChange} />
          <InputField label="Last Name" name="last_name" value={user.last_name} onChange={handleChange} />
          <InputField label="Username" name="username" value={user.username} onChange={handleChange} />
          <InputField label="Phone Number" name="phone_number" value={user.phone_number} onChange={handleChange} />

          <div>
            <label className="block font-medium">Gender:</label>
            <select name="gender" value={user.gender} onChange={handleChange} className="w-full p-2 border rounded" required>
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block font-medium">Role:</label>
            <select name="role_id" value={user.role_id} onChange={handleChange} className="w-full p-2 border rounded" required>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium">Warehouse:</label>
            <select name="warehouse_id" value={user.warehouse_id} onChange={handleChange} className="w-full p-2 border rounded" required>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>{wh.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium">Status:</label>
            <select name="is_active" value={user.is_active.toString()} onChange={handleChange} className="w-full p-2 border rounded">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <div className="flex justify-between pt-2">
            <button type="button" onClick={onClose} className="bg-red-500 text-white py-2 px-4 rounded">Cancel</button>
            <button type="submit" className="bg-blue-500 text-white py-2 px-4 rounded" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Helper component for cleaner inputs
const InputField = ({ label, name, value, onChange }) => (
  <div>
    <label className="block font-medium">{label}:</label>
    <input
      type="text"
      name={name}
      value={value}
      onChange={onChange}
      className="w-full p-2 border rounded"
      required
    />
  </div>
);

export default EditUser;