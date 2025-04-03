import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";

const SupplierEditForm = () => {
    const { id } = useParams(); // Get supplier ID from URL
    const navigate = useNavigate();
    const [supplier, setSupplier] = useState({
        company_name: "",
        bir_no: "",
        contact_person: "",
        email: "",
        phone_number: "",
        street_address: "",
        city: "",
        region: "",
        zip_code: ""
        
    });

    // ✅ Fetch supplier data when component mounts
    useEffect(() => {
        axios.get(`http://localhost:8080/api/suppliers/${id}/`)
            .then(response => setSupplier(response.data))
            .catch(error => console.error("Error fetching supplier data:", error));
    }, [id]);

    // ✅ Handle form field changes
    const handleChange = (e) => {
        setSupplier({ ...supplier, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
          const response = await axios.put(`http://localhost:8080/api/suppliers/${id}/`, supplier);
          
          console.log("Update Response:", response); // Debugging: Log API response
  
          if (response.status === 200) { 
              alert("Supplier updated successfully!");
              navigate("/suppliers"); // ✅ Redirect after successful update
          } else {
              alert("Failed to update supplier. Please try again.");
          }
      } catch (error) {
          console.error("Error updating supplier:", error);
          alert("Error updating supplier. Check console for details.");
      }
  };

    return (
        <div className="container mx-auto p-6">
            <h2 className="text-2xl font-bold border-l-4 border-blue-500 pl-2">Edit Supplier</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <h3 className="font-semibold">Company Information</h3>
                    <input type="text" name="company_name" value={supplier.company_name} onChange={handleChange} placeholder="Company Name" className="w-full border p-2" />
                    <input type="text" name="bir_no" value={supplier.bir_no} onChange={handleChange} placeholder="BIR NO." className="w-full border p-2 mt-2" />
                </div>

                <div>
                    <h3 className="font-semibold">Contact Information</h3>
                    <input type="text" name="contact_person" value={supplier.contact_person} onChange={handleChange} placeholder="Contact Person" className="w-full border p-2" />
                    <input type="email" name="email" value={supplier.email} onChange={handleChange} placeholder="Email" className="w-full border p-2 mt-2" />
                    <input type="text" name="phone_number" value={supplier.phone_number} onChange={handleChange} placeholder="Phone Number" className="w-full border p-2 mt-2" />
                </div>

                <div>
                    <h3 className="font-semibold">Address</h3>
                    <input type="text" name="street_address" value={supplier.street_address} onChange={handleChange} placeholder="Street Address" className="w-full border p-2" />
                    <input type="text" name="city" value={supplier.city} onChange={handleChange} placeholder="City" className="w-full border p-2 mt-2" />
                    <input type="text" name="region" value={supplier.region} onChange={handleChange} placeholder="Region" className="w-full border p-2 mt-2" />
                    <input type="text" name="zip_code" value={supplier.zip_code} onChange={handleChange} placeholder="Zip Code" className="w-full border p-2 mt-2" />
                </div>

                <div className="flex justify-between">
                    <button type="button" onClick={() => navigate("/suppliers")} className="border px-4 py-2">Cancel</button>
                    <button type="submit" className="bg-blue-500 text-white px-4 py-2">Update Supplier</button>
                </div>
            </form>
        </div>
    );
};

export default SupplierEditForm;
