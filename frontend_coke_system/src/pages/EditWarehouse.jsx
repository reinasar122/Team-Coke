import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

const EditWarehouse = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [warehouse, setWarehouse] = useState({
    name: "",
    street: "",
    city: "",
    country: "",
    zip_code: "",
    phone_number: "",
    email: "",
  });

  useEffect(() => {
    const fetchWarehouse = async () => {
      try {
        console.log("Fetching warehouse data..."); // Debugging
        const response = await fetch(`http://127.0.0.1:8000/api/warehouses/${id}/`);  // ✅ Correct

        
        if (!response.ok) {
          throw new Error("Failed to fetch warehouse data");
        }
  
        const data = await response.json();
        console.log("Warehouse data received:", data); // Debugging
        setWarehouse(data);
      } catch (error) {
        console.error("Error fetching warehouse:", error);
      }
    };
  
    fetchWarehouse();
  }, [id]);
  

  const handleChange = (e) => {
    setWarehouse({ ...warehouse, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/warehouses/${id}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(warehouse),
      });

      if (!response.ok) {
        throw new Error("Failed to update warehouse");
      }

      navigate("/warehouses");
    } catch (error) {
      console.error("Error updating warehouse:", error);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-lg">
        <h2 className="text-2xl font-semibold text-center mb-4">Edit Warehouse</h2>

        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <label className="block font-medium">Name:</label>
            <input type="text" name="name" value={warehouse.name} onChange={handleChange} 
              className="w-full p-2 border rounded focus:ring focus:ring-blue-300" required />
          </div>

          <div>
            <label className="block font-medium">Street:</label>
            <input type="text" name="street" value={warehouse.street} onChange={handleChange} 
              className="w-full p-2 border rounded focus:ring focus:ring-blue-300" required />
          </div>

          <div>
            <label className="block font-medium">City:</label>
            <input type="text" name="city" value={warehouse.city} onChange={handleChange} 
              className="w-full p-2 border rounded focus:ring focus:ring-blue-300" required />
          </div>

          <div>
            <label className="block font-medium">Country:</label>
            <select name="country" value={warehouse.country} onChange={handleChange} 
              className="w-full p-2 border rounded focus:ring focus:ring-blue-300" required>
              <option value="">Select Country</option>
              <option value="Philippines">Philippines</option>
              <option value="Canada">Canada</option>
              <option value="UK">UK</option>
            </select>
          </div>

          <div>
            <label className="block font-medium">Zip Code:</label>
            <input type="text" name="zip_code" value={warehouse.zip_code} onChange={handleChange} 
              className="w-full p-2 border rounded focus:ring focus:ring-blue-300" required />
          </div>

          <div>
            <label className="block font-medium">Phone Number:</label>
            <input type="text" name="phone_number" value={warehouse.phone_number} onChange={handleChange} 
              className="w-full p-2 border rounded focus:ring focus:ring-blue-300" required />
          </div>

          <div>
            <label className="block font-medium">Email:</label>
            <input type="email" name="email" value={warehouse.email} onChange={handleChange} 
              className="w-full p-2 border rounded focus:ring focus:ring-blue-300" required />
          </div>

          <div className="flex justify-between">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
              Save Changes
            </button>
            <button type="button" onClick={() => navigate("/warehouses")} 
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-700">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditWarehouse;
