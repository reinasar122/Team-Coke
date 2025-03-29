import { useState } from "react";
import { useNavigate } from "react-router-dom";

const WarehouseForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    street: "",
    city: "",
    country: "",
    region: "",
    zip_code: "",
    phone_number: "",
    email: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://127.0.0.1:8080/api/warehouses/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        navigate("/warehouses"); // Redirect after successful creation
      } else {
        console.error("Failed to create warehouse");
      }
    } catch (error) {
      console.error("Error creating warehouse:", error);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow-md rounded-md">
      <h2 className="text-2xl font-semibold mb-4">New Warehouse</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="block font-medium">Name of Warehouse</label>
          <input type="text" name="name" className="w-full border p-2 rounded" required onChange={handleChange} />
        </div>
        <div className="mb-3">
          <label className="block font-medium">Street</label>
          <input type="text" name="street" className="w-full border p-2 rounded" required onChange={handleChange} />
        </div>
        <div className="mb-3">
          <label className="block font-medium">City</label>
          <input type="text" name="city" className="w-full border p-2 rounded" required onChange={handleChange} />
        </div>
        <div className="mb-3">
          <label className="block font-medium">Country</label>
          <select name="country" className="w-full border p-2 rounded" required onChange={handleChange}>
            <option value="">Select Country</option>
            <option value="Philippines">Philippines</option>
            <option value="Canada">Canada</option>
            <option value="UK">UK</option>
          </select>
        </div>
        <div className="mb-3">
          <label className="block font-medium">Region</label>
          <input type="text" name="region" className="w-full border p-2 rounded" required onChange={handleChange} />
        </div>
        <div className="mb-3">
          <label className="block font-medium">Zip Code</label>
          <input type="text" name="zip_code" className="w-full border p-2 rounded" required onChange={handleChange} />
        </div>
        <div className="mb-3">
          <label className="block font-medium">Phone No.</label>
          <input type="text" name="phone_number" className="w-full border p-2 rounded" required onChange={handleChange} />
        </div>
        <div className="mb-3">
          <label className="block font-medium">Email</label>
          <input type="email" name="email" className="w-full border p-2 rounded" required onChange={handleChange} />
        </div>
        <div className="flex justify-between">
          <button type="submit" className="bg-blue-500 text-white py-2 px-4 rounded">Save</button>
          <button type="button" className="bg-red-500 text-white py-2 px-4 rounded" onClick={() => navigate("/warehouses")}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default WarehouseForm;
