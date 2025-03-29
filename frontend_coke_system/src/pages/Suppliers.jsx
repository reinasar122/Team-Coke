import React, { useState, useEffect } from "react";
import axios from "axios";
import SupplierRegistrationForm from "./SupplierRegistrationForm";
import { FaEdit, FaPlus, FaEye, FaEyeSlash } from "react-icons/fa";

const API_URL = "http://127.0.0.1:8080/api/suppliers/";

const SupplierList = ({ suppliers, onEdit, onAddNew }) => {
  const [hiddenSuppliers, setHiddenSuppliers] = useState([]);

  const toggleVisibility = (id) => {
    setHiddenSuppliers(hiddenSuppliers.includes(id)
      ? hiddenSuppliers.filter(supplierId => supplierId !== id)
      : [...hiddenSuppliers, id]);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Supplier Details</h1>
        <button
          onClick={onAddNew}
          className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          <FaPlus className="mr-2" /> New
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Registration Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Company Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Contact Person
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Contact Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {suppliers.map((supplier) => (
              <tr key={supplier.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm">{supplier.registration_number}</td>
                <td className="px-6 py-4 text-sm">{supplier.company_name}</td>
                <td className="px-6 py-4 text-sm">{supplier.contact_person}</td>
                <td className="px-6 py-4 text-sm">{supplier.phone_number}</td>
                <td className="px-6 py-4 text-sm flex gap-2">
                  <button onClick={() => onEdit(supplier.id)} className="text-blue-600 hover:text-blue-900">
                    <FaEdit size={18} />
                  </button>
                  <button onClick={() => toggleVisibility(supplier.id)} className="text-gray-600 hover:text-gray-900">
                    {hiddenSuppliers.includes(supplier.id) ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState(null);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get(API_URL);
      setSuppliers(response.data);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      if (currentSupplier) {
        await axios.put(`${API_URL}${currentSupplier.id}/`, formData);
      } else {
        await axios.post(API_URL, formData);
      }
      fetchSuppliers();
    } catch (error) {
      console.error("Error saving supplier:", error);
    }
    setShowForm(false);
    setCurrentSupplier(null);
  };

  const handleEdit = (id) => {
    const supplier = suppliers.find((s) => s.id === id);
    setCurrentSupplier(supplier);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setCurrentSupplier(null);
    setShowForm(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {showForm ? (
        <SupplierRegistrationForm onSubmit={handleSubmit} initialData={currentSupplier} />
      ) : (
        <SupplierList suppliers={suppliers} onEdit={handleEdit} onAddNew={handleAddNew} />
      )}
    </div>
  );
};

export default Suppliers;
