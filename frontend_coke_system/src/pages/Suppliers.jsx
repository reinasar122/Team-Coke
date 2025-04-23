import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaTrash, FaEdit } from "react-icons/fa";

const Suppliers = () => {
    const [suppliers, setSuppliers] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        axios.get("http://localhost:8080/api/suppliers/")
            .then(response => setSuppliers(response.data))
            .catch(error => console.error("Error fetching suppliers:", error));
    }, []);


    // ✅ Function to delete a supplier
    const handleDelete = async (id) => {
      if (window.confirm("Are you sure you want to delete this supplier?")) {
          try {
              await axios.delete(`http://localhost:8080/api/suppliers/${id}/`);
              setSuppliers(suppliers.filter(supplier => supplier.id !== id)); // ✅ Remove from state
              alert("Supplier deleted successfully!");
          } catch (error) {
              console.error("Error deleting supplier:", error);
              alert("Failed to delete supplier.");
          }
      }
  };


    return (
        <div className="container mx-auto p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Supplier Registration Details</h2>
                <button onClick={() => navigate("/register-supplier")} className="bg-red-500 text-white px-4 py-2 rounded">
            + New
        </button>
            </div>
            <table className="w-full border">
                <thead>
                    <tr className="bg-gray-200">
                        <th className="border p-2">REGISTRATION NUMBER</th>
                        <th className="border p-2">COMPANY NAME</th>
                        <th className="border p-2">CONTACT PERSON</th>
                        <th className="border p-2">CONTACT NUMBER</th>
                        <th className="border p-2">STREET ADDRESS</th>
                        <th className="border p-2">ACTIONS</th>
                    </tr>
                </thead>
                <tbody>
                    {suppliers.map(supplier => (
                        <tr key={supplier.id} className="border">
                            <td className="border p-2">{supplier.registration_number}</td>
                            <td className="border p-2">{supplier.company_name}</td>
                            <td className="border p-2">{supplier.contact_person}</td>
                            <td className="border p-2">{supplier.phone_number}</td>
                            <td className="border p-2">{supplier.street_address}</td>
                            <td className="border p-2 flex gap-2">
                            <FaEdit className="text-blue-500 cursor-pointer" onClick={() => navigate(`/edit-supplier/${supplier.id}`)} />
                                <FaTrash 
                                    className="text-red-500 cursor-pointer" 
                                    onClick={() => handleDelete(supplier.id)} // ✅ Call delete function
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default Suppliers;
