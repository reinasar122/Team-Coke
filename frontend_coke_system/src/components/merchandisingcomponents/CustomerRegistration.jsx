import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { getCurrentWarehouse, findWarehouseByName } from "../../utils/warehouseUtils";

const CustomerRegistration = () => {
  const navigate = useNavigate();
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isDeleting, setIsDeleting] = useState(null);
  const [warehouseLoading, setWarehouseLoading] = useState(true);

  // Customer form state
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    address: "",
    phone_number: "",
    email: "",
  });
  
  const [customerErrors, setCustomerErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");

  // Get current warehouse using utility
  useEffect(() => {
    const initializeWarehouse = async () => {
      setWarehouseLoading(true);
      try {
        const warehouse = getCurrentWarehouse();
        console.log('🏭 Current warehouse from utility:', warehouse);
        
        if (warehouse) {
          if (warehouse.needsIdLookup && warehouse.name) {
            console.log('🔍 Looking up warehouse ID for:', warehouse.name);
            const foundWarehouse = await findWarehouseByName(warehouse.name);
            if (foundWarehouse) {
              setCurrentWarehouse(foundWarehouse);
            } else {
              console.error('❌ Could not find warehouse by name:', warehouse.name);
              showAlert("Warehouse not found. Please contact administrator.");
            }
          } else {
            setCurrentWarehouse(warehouse);
          }
        } else {
          console.error('❌ No warehouse available');
          showAlert("No warehouse assigned. Please contact administrator.");
        }
      } catch (error) {
        console.error('❌ Error initializing warehouse:', error);
        showAlert("Error loading warehouse information.");
      } finally {
        setWarehouseLoading(false);
      }
    };

    initializeWarehouse();

    const handleWarehouseChange = async (event) => {
      console.log('🔄 Warehouse changed:', event.detail);
      const { warehouse } = event.detail;
      
      if (warehouse) {
        if (warehouse.needsIdLookup && warehouse.name) {
          const foundWarehouse = await findWarehouseByName(warehouse.name);
          setCurrentWarehouse(foundWarehouse);
        } else {
          setCurrentWarehouse(warehouse);
        }
      } else {
        const defaultWarehouse = getCurrentWarehouse();
        setCurrentWarehouse(defaultWarehouse);
      }
    };

    window.addEventListener('warehouseChanged', handleWarehouseChange);
    return () => window.removeEventListener('warehouseChanged', handleWarehouseChange);
  }, []);

  // Load existing customers
  useEffect(() => {
    if (!currentWarehouse?.id || warehouseLoading) return;

    const loadCustomers = async () => {
      try {
        console.log('📡 Loading customers for warehouse:', currentWarehouse.id);
        const response = await api.get("customers/", {
          params: { warehouse: currentWarehouse.id }
        });
        setCustomers(response.data);
        console.log('✅ Customers loaded:', response.data.length, 'customers');
      } catch (error) {
        console.error("❌ Failed to load customers:", error);
        showAlert("Failed to load customers. Please try again.");
      }
    };

    loadCustomers();
  }, [currentWarehouse, warehouseLoading]);

  const showAlert = (message, type = "info") => {
    if (type === "success") {
      setSuccessMessage(message);
      setTimeout(() => setSuccessMessage(""), 5000);
    } else {
      const alertDiv = document.createElement("div");
      alertDiv.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
      alertDiv.innerHTML = `
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
          <p class="text-gray-700 dark:text-gray-300 mb-4">${message}</p>
          <div class="flex justify-end">
            <button class="btn btn-primary" onclick="this.closest('.fixed').remove()">OK</button>
          </div>
        </div>
      `;
      document.body.appendChild(alertDiv);
    }
  };

  const showConfirmDialog = (message, onConfirm) => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
        <p class="text-gray-700 dark:text-gray-300 mb-4">${message}</p>
        <div class="flex justify-end space-x-3">
          <button class="btn btn-cancel cancel-btn">Cancel</button>
          <button class="btn btn-danger confirm-btn">Confirm</button>
        </div>
      </div>
    `;
    
    const cancelBtn = modal.querySelector('.cancel-btn');
    const confirmBtn = modal.querySelector('.confirm-btn');
    
    cancelBtn.onclick = () => modal.remove();
    confirmBtn.onclick = () => {
      modal.remove();
      onConfirm();
    };
    
    document.body.appendChild(modal);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewCustomer(prev => ({ ...prev, [name]: value }));
    
    if (customerErrors[name]) {
      setCustomerErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateCustomer = (isEdit = false) => {
    const errors = {};
    
    if (!newCustomer.name.trim()) {
      errors.name = "Customer name is required";
    }
    
    if (!newCustomer.address.trim()) {
      errors.address = "Address is required";
    }
    
    if (!newCustomer.phone_number.trim()) {
      errors.phone_number = "Phone number is required";
    } else if (!/^[0-9+\-\s()]+$/.test(newCustomer.phone_number)) {
      errors.phone_number = "Please enter a valid phone number";
    }
    
    if (newCustomer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCustomer.email)) {
      errors.email = "Please enter a valid email address";
    }
    
    const nameExists = customers.some(customer => 
      customer.name?.toLowerCase() === newCustomer.name.trim().toLowerCase() && 
      (!isEdit || customer.id !== editingCustomer?.id)
    );
    
    if (nameExists) {
      errors.name = "A customer with this name already exists";
    }
    
    return errors;
  };

  const resetForm = () => {
    setNewCustomer({
      name: "",
      address: "",
      phone_number: "",
      email: "",
    });
    setCustomerErrors({});
    setEditingCustomer(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const isEdit = editingCustomer !== null;
    const errors = validateCustomer(isEdit);
    
    if (Object.keys(errors).length > 0) {
      setCustomerErrors(errors);
      return;
    }

    if (!currentWarehouse?.id) {
      showAlert("No warehouse selected. Please contact administrator.");
      return;
    }

    setIsLoading(true);
    setCustomerErrors({});

    try {
      const customerData = {
        name: newCustomer.name.trim(),
        address: newCustomer.address.trim(),
        phone: newCustomer.phone_number.trim(),
        email: newCustomer.email.trim() || null,
        warehouse: currentWarehouse.id,
      };

      console.log('💾 Saving customer to warehouse:', currentWarehouse.id, customerData);

      let response;
      if (isEdit) {
        response = await api.patch(`customers/${editingCustomer.id}/`, customerData);
        console.log("✅ Customer updated:", response.data);
        
        setCustomers(prev => prev.map(customer => 
          customer.id === editingCustomer.id ? response.data : customer
        ));
        
        showAlert("Customer updated successfully!", "success");
      } else {
        response = await api.post("customers/", customerData);
        console.log("✅ New customer created:", response.data);
        
        setCustomers(prev => [...prev, response.data]);
        
        showAlert("Customer registered successfully!", "success");
      }
      
      resetForm();
      
    } catch (error) {
      console.error("❌ Error saving customer:", error);
      
      if (error.response?.data) {
        const backendErrors = {};
        Object.keys(error.response.data).forEach(key => {
          if (Array.isArray(error.response.data[key])) {
            backendErrors[key] = error.response.data[key][0];
          } else {
            backendErrors[key] = error.response.data[key];
          }
        });
        setCustomerErrors(backendErrors);
      } else {
        showAlert(`Failed to ${isEdit ? 'update' : 'register'} customer. Please try again.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setNewCustomer({
      name: customer.name || "",
      address: customer.address || "",
      phone_number: customer.phone || "",
      email: customer.email || "",
    });
    setCustomerErrors({});
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (customer) => {
    showConfirmDialog(
      `Are you sure you want to delete "${customer.name}"? This action cannot be undone.`,
      async () => {
        setIsDeleting(customer.id);
        try {
          await api.delete(`customers/${customer.id}/`);
          console.log("✅ Customer deleted:", customer.name);
          
          setCustomers(prev => prev.filter(c => c.id !== customer.id));
          
          showAlert("Customer deleted successfully!", "success");
        } catch (error) {
          console.error("❌ Error deleting customer:", error);
          showAlert("Failed to delete customer. Please try again.");
        } finally {
          setIsDeleting(null);
        }
      }
    );
  };

  const handleContinueToSale = () => {
    navigate("/merchandising-sale", {
      state: {
        transactionTypeName: "Warehouse",
        selectedTransactionTypeName: "Warehouse",
      }
    });
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show loading while warehouse is being determined
  if (warehouseLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading warehouse information...</p>
        </div>
      </div>
    );
  }

  // Show error if no warehouse is available
  if (!currentWarehouse) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Warehouse Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">No warehouse is assigned to your account.</p>
          <button
            onClick={() => navigate(-1)}
            className="btn btn-back"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Customer Management</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                {editingCustomer ? 'Edit customer information' : 'Register new customers for merchandising sales'}
              </p>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="btn btn-back"
            >
              Back
            </button>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-green-800 dark:text-green-200 font-medium">{successMessage}</span>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          
          {/* Registration/Edit Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingCustomer ? 'Edit Customer' : 'Register New Customer'}
              </h2>
              {editingCustomer && (
                <button
                  onClick={resetForm}
                  className="btn btn-cancel"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Customer Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={newCustomer.name}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors ${
                    customerErrors.name ? 'border-red-500 dark:border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter customer name"
                />
                {customerErrors.name && (
                  <p className="text-red-500 text-sm mt-1">{customerErrors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Address *
                </label>
                <textarea
                  id="address"
                  name="address"
                  value={newCustomer.address}
                  onChange={handleInputChange}
                  rows={3}
                  className={`w-full px-3 py-2 border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none transition-colors ${
                    customerErrors.address ? 'border-red-500 dark:border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Street, Barangay, City, Province"
                />
                {customerErrors.address && (
                  <p className="text-red-500 text-sm mt-1">{customerErrors.address}</p>
                )}
              </div>

              <div>
                <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Phone Number *
                </label>
                <input
                  type="text"
                  id="phone_number"
                  name="phone_number"
                  value={newCustomer.phone_number}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors ${
                    customerErrors.phone_number ? 'border-red-500 dark:border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="09XXXXXXXXX"
                />
                {customerErrors.phone_number && (
                  <p className="text-red-500 text-sm mt-1">{customerErrors.phone_number}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={newCustomer.email}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors ${
                    customerErrors.email ? 'border-red-500 dark:border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="customer@example.com"
                />
                {customerErrors.email && (
                  <p className="text-red-500 text-sm mt-1">{customerErrors.email}</p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 btn btn-primary"
                >
                  {isLoading ? (editingCustomer ? "Updating..." : "Registering...") : (editingCustomer ? "Update Customer" : "Register Customer")}
                </button>
                
                {!editingCustomer && (
                  <button
                    type="button"
                    onClick={handleContinueToSale}
                    className="btn btn-add"
                  >
                    Continue to Sale
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Customer List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Registered Customers ({customers.length})
              </h2>
            </div>
            
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-colors"
              />
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className={`p-3 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors ${
                      editingCustomer?.id === customer.id ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">{customer.name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{customer.phone}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-500 truncate">{customer.address}</div>
                        {customer.email && (
                          <div className="text-xs text-gray-500 dark:text-gray-500">{customer.email}</div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-3">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="btn btn-edit text-xs"
                          disabled={isLoading}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(customer)}
                          className="btn btn-danger text-xs"
                          disabled={isLoading || isDeleting === customer.id}
                        >
                          {isDeleting === customer.id ? "..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  {searchTerm ? "No customers found matching your search." : "No customers registered yet."}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerRegistration;