import React, { useState } from 'react';
import { FaEye, FaEyeSlash, FaEdit, FaPlus } from 'react-icons/fa';

// Supplier Registration Form Component
const SupplierRegistrationForm = ({ onSubmit, onClear, initialData }) => {
  const [formData, setFormData] = useState(initialData || {
    companyName: '',
    registrationNumber: '',
    birNo: '',
    contactPerson: '',
    email: '',
    phoneNumber: '',
    streetAddress: '',
    city: '',
    region: '',
    zipCode: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleClear = () => {
    setFormData({
      companyName: '',
      registrationNumber: '',
      birNo: '',
      contactPerson: '',
      email: '',
      phoneNumber: '',
      streetAddress: '',
      city: '',
      region: '',
      zipCode: ''
    });
    if (onClear) onClear();
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="border-l-4 border-red-600 pl-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Supplier Registration</h1>
      </div>
      
      <form onSubmit={handleSubmit}>
        {/* Company Information Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Company Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-base"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Registration Number</label>
              <input
                type="text"
                name="registrationNumber"
                value={formData.registrationNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-base"
                required
              />
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">BIR NO.</label>
            <input
              type="text"
              name="birNo"
              value={formData.birNo}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-base"
              required
            />
          </div>
        </div>
        
        {/* Contact Information Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Contact Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Person</label>
              <input
                type="text"
                name="contactPerson"
                value={formData.contactPerson}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-base"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-base"
                required
              />
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-base"
              required
            />
          </div>
        </div>
        
        {/* Address Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Address</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Street Address</label>
            <input
              type="text"
              name="streetAddress"
              value={formData.streetAddress}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-base"
              required
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-base"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Region</label>
              <input
                type="text"
                name="region"
                value={formData.region}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-base"
                required
              />
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Zip Code</label>
            <input
              type="text"
              name="zipCode"
              value={formData.zipCode}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-base"
              required
            />
          </div>
        </div>
        
        
        {/* Form Buttons */}
        <div className="flex justify-end space-x-4 mt-8">
          <button
            type="button"
            onClick={handleClear}
            className="px-6 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-600 dark:text-white dark:border-gray-500 dark:hover:bg-gray-700"
          >
            Clear Forms
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-red-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Submit Registration
          </button>
        </div>
      </form>
    </div>
  );
};

// Supplier List Component
const SupplierList = ({ suppliers, onView, onEdit, onAddNew }) => {
  // Initialize a state to track hidden suppliers
  const [hiddenSuppliers, setHiddenSuppliers] = useState([]);
  
  // Toggle visibility of a supplier
  const toggleVisibility = (id) => {
    if (hiddenSuppliers.includes(id)) {
      setHiddenSuppliers(hiddenSuppliers.filter(supplierId => supplierId !== id));
    } else {
      setHiddenSuppliers([...hiddenSuppliers, id]);
    }
  };
  
  // Check if a supplier is hidden
  const isSupplierHidden = (id) => {
    return hiddenSuppliers.includes(id);
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Supplier Registration Details</h1>
        <button
          onClick={onAddNew}
          className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <FaPlus className="mr-2" /> New
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Registration Number
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Company Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Contact Number
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
            {suppliers.map((supplier) => (
              <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {isSupplierHidden(supplier.id) ? '••••••••' : supplier.registrationNumber}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {isSupplierHidden(supplier.id) ? '••••••••' : supplier.companyName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {isSupplierHidden(supplier.id) ? '••••••••' : supplier.phoneNumber}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => toggleVisibility(supplier.id)}
                      className={`${isSupplierHidden(supplier.id) ? 'text-gray-400' : 'text-gray-600'} hover:text-gray-900 dark:hover:text-white`}
                      aria-label={isSupplierHidden(supplier.id) ? "Show Data" : "Hide Data"}
                      title={isSupplierHidden(supplier.id) ? "Show Data" : "Hide Data"}
                    >
                      {isSupplierHidden(supplier.id) ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                    </button>
                    <button
                      onClick={() => onEdit(supplier.id)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      aria-label="Edit"
                    >
                      <FaEdit size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Main App Component
const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([
    {
      id: 1,
      registrationNumber: 'RN-00010',
      companyName: 'Coca Cola Philippines',
      phoneNumber: '09356830299',
      birNo: '123456789',
      contactPerson: 'John Doe',
      email: 'contact@cocacola.ph',
      streetAddress: '123 Main St',
      city: 'Makati',
      region: 'NCR',
      zipCode: '1200'
    }
  ]);
  
  const [showForm, setShowForm] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState(null);

  const handleSubmit = (formData) => {
    if (currentSupplier) {
      // Update existing supplier
      setSuppliers(suppliers.map(supplier => 
        supplier.id === currentSupplier.id ? { ...formData, id: supplier.id } : supplier
      ));
    } else {
      // Add new supplier
      const newSupplier = {
        ...formData,
        id: Date.now(),
        registrationNumber: `RN-${String(suppliers.length + 1).padStart(5, '0')}`
      };
      setSuppliers([...suppliers, newSupplier]);
    }
    
    setShowForm(false);
    setCurrentSupplier(null);
  };

  const handleView = (id) => {
    setCurrentSupplier(null); // Clear current supplier to hide form
  };

  const handleEdit = (id) => {
    const supplier = suppliers.find(s => s.id === id);
    setCurrentSupplier(supplier);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setCurrentSupplier(null);
    setShowForm(true);
  };

  const handleClear = () => {
    setCurrentSupplier(null);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {showForm ? (
        <SupplierRegistrationForm 
          onSubmit={handleSubmit} 
          onClear={handleClear}
          initialData={currentSupplier}
        />
      ) : (
        <SupplierList 
          suppliers={suppliers} 
          onView={handleView} 
          onEdit={handleEdit} 
          onAddNew={handleAddNew} 
        />
      )}
    </div>
  );
};

export default Suppliers;