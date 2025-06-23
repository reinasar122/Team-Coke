import { useState, useEffect } from "react";

const UserForm = ({ onUserAdded, onClose }) => {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    gender: "",
    phone_number: "",
    email: "",             // ✅ new field
    role_id: "",
    warehouse_id: "",
    username: "",
    is_active: true,
    password: "",
  });

  const [roles, setRoles] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8080/api/roles/");
        const data = await response.json();
        setRoles(data);
      } catch (error) {
        console.error("Error fetching roles:", error);
      }
    };

    const fetchWarehouses = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8080/api/warehouses/");
        const data = await response.json();
        setWarehouses(data);
      } catch (error) {
        console.error("Error fetching warehouses:", error);
      }
    };

    fetchRoles();
    fetchWarehouses();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const userPayload = {
      ...formData,
      role_id: Number(formData.role_id) || null,
      warehouse_id: Number(formData.warehouse_id) || null,
      is_active: Boolean(formData.is_active),
    };

    try {
      const response = await fetch("http://127.0.0.1:8080/api/users/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userPayload),
      });

      const data = await response.json();
      console.log("Response:", response.status, data);

      if (response.ok) {
        onUserAdded(data);
        onClose();
      } else {
        alert(`Error: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.error("Error creating user:", error);
      alert("An unexpected error occurred. Check console for details.");
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
      <div className="w-full max-w-3xl p-8 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">New User</h2>
        <form onSubmit={handleSubmit}>
          {/* Name Fields */}
          <div className="mb-5 flex gap-6">
            <div className="w-1/2">
              <label className="block font-medium">First Name</label>
              <input type="text" name="first_name" className="w-full border p-2 rounded" required onChange={handleChange} />
            </div>
            <div className="w-1/2">
              <label className="block font-medium">Last Name</label>
              <input type="text" name="last_name" className="w-full border p-2 rounded" required onChange={handleChange} />
            </div>
          </div>

          {/* Gender & Phone */}
          <div className="mb-5 flex gap-6">
            <div className="w-1/2">
              <label className="block font-medium">Gender</label>
              <select name="gender" className="w-full border p-2 rounded" required onChange={handleChange}>
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="w-1/2">
              <label className="block font-medium">Phone Number</label>
              <input type="text" name="phone_number" className="w-full border p-2 rounded" required onChange={handleChange} />
            </div>
          </div>

          {/* Email */}
          <div className="mb-5">
            <label className="block font-medium">Email</label>
            <input type="email" name="email" className="w-full border p-2 rounded" required onChange={handleChange} />
          </div>

          {/* Role & Warehouse */}
          <div className="mb-5 flex gap-6">
            <div className="w-1/2">
              <label className="block font-medium">Role</label>
              <select name="role_id" className="w-full border p-2 rounded" required onChange={handleChange}>
                <option value="">Select Role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>
            <div className="w-1/2">
              <label className="block font-medium">Warehouse</label>
              <select name="warehouse_id" className="w-full border p-2 rounded" required onChange={handleChange}>
                <option value="">Select Warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Username & Password */}
          <div className="mb-5 flex gap-6">
            <div className="w-1/2">
              <label className="block font-medium">Username</label>
              <input type="text" name="username" className="w-full border p-2 rounded" required onChange={handleChange} />
            </div>
            <div className="w-1/2">
              <label className="block font-medium">Password</label>
              <input type="password" name="password" className="w-full border p-2 rounded" required onChange={handleChange} />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-between">
            <button type="button" className="bg-red-500 text-white py-2 px-4 rounded" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="bg-blue-500 text-white py-2 px-4 rounded">
              Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserForm;
