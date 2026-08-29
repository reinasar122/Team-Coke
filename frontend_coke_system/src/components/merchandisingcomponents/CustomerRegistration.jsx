import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../api";
import { getCurrentWarehouse, findWarehouseByName } from "../../utils/warehouseUtils";
import { FaUserFriends } from "react-icons/fa";
import "../../styles/pages/customer-registration.scss";

const sanitizePhoneNumber = (value) => String(value || "").replace(/\D/g, "").slice(0, 11);

const CustomerRegistration = ({
  embedded = false,
  onClose = null,
  onCustomerSelected = null,
  onCustomersChange = null,
  saleContext = null,
  isClosing = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const cameFromMerchandisingSale = embedded || location.state?.from === "merchandising-sale";
  const panelModeTitle = embedded ? "Add or Select Customer" : "Customer Registration";
  const panelModeSubtitle = embedded
    ? "Stay on the sale page. Register or choose an existing customer."
    : editingCustomer
      ? "Edit customer information"
      : cameFromMerchandisingSale
        ? "Register new customer and return to sale"
        : "Register new customers for merchandising sales";

  useEffect(() => {
    if (!embedded) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [embedded, onClose]);

  useEffect(() => {
    if (!embedded) return undefined;

    setIsDrawerVisible(false);
    const rafId = window.requestAnimationFrame(() => {
      setIsDrawerVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [embedded]);

  // Get current warehouse using utility
  useEffect(() => {
    const initializeWarehouse = async () => {
      setWarehouseLoading(true);
      try {
        const warehouse = getCurrentWarehouse();
        console.log('Ã°Å¸ÂÂ­ Current warehouse from utility:', warehouse);
        
        if (warehouse) {
          if (warehouse.needsIdLookup && warehouse.name) {
            console.log('Ã°Å¸â€Â Looking up warehouse ID for:', warehouse.name);
            const foundWarehouse = await findWarehouseByName(warehouse.name);
            if (foundWarehouse) {
              setCurrentWarehouse(foundWarehouse);
            } else {
              console.error('Ã¢ÂÅ’ Could not find warehouse by name:', warehouse.name);
              showAlert("Warehouse not found. Please contact administrator.");
            }
          } else {
            setCurrentWarehouse(warehouse);
          }
        } else {
          console.error('Ã¢ÂÅ’ No warehouse available');
          showAlert("No warehouse assigned. Please contact administrator.");
        }
      } catch (error) {
        console.error('Ã¢ÂÅ’ Error initializing warehouse:', error);
        showAlert("Error loading warehouse information.");
      } finally {
        setWarehouseLoading(false);
      }
    };

    initializeWarehouse();

    const handleWarehouseChange = async (event) => {
      console.log('Ã°Å¸â€â€ž Warehouse changed:', event.detail);
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
        console.log('Ã°Å¸â€œÂ¡ Loading customers for warehouse:', currentWarehouse.id);
        const response = await api.get("customers/", {
          params: { warehouse: currentWarehouse.id }
        });
        updateCustomersList(response.data);
        console.log('Ã¢Å“â€¦ Customers loaded:', response.data.length, 'customers');
      } catch (error) {
        console.error("Ã¢ÂÅ’ Failed to load customers:", error);
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
      alertDiv.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1300]";
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
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1300]';
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
    const nextValue = name === "phone_number" ? sanitizePhoneNumber(value) : value;
    setNewCustomer(prev => ({ ...prev, [name]: nextValue }));
    
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
    
    const normalizedPhone = sanitizePhoneNumber(newCustomer.phone_number);

    if (!normalizedPhone) {
      errors.phone_number = "Phone number is required";
    } else if (!/^\d+$/.test(normalizedPhone)) {
      errors.phone_number = "Phone number must contain digits only";
    } else if (normalizedPhone.length !== 11) {
      errors.phone_number = "Phone number must be 11 digits (e.g., 09xx-xxx-xxxx)";
    } else if (!normalizedPhone.startsWith("09")) {
      errors.phone_number = "Phone number must start with 09 (Philippines format)";
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

  const updateCustomersList = (updater) => {
    setCustomers((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      onCustomersChange?.(next);
      return next;
    });
  };

  const handleSelectCustomer = (customer) => {
    if (!customer) return;

    if (embedded) {
      if (onCustomerSelected) {
        onCustomerSelected(customer);
      } else {
        onClose?.();
      }
      return;
    }

    if (cameFromMerchandisingSale) {
      navigate(location.state?.returnPath || "/merchandising-sale", {
        state: {
          ...location.state?.currentFormData,
          newlyCreatedCustomer: customer,
          autoSelectCustomer: true,
        },
      });
      return;
    }

    showAlert(`Selected customer: ${customer.name}`, "success");
  };

  const handleExit = () => {
    if (embedded) {
      onClose?.();
      return;
    }

    if (location.state?.from === "merchandising-sale") {
      navigate(location.state.returnPath || "/merchandising-sale", {
        state: location.state.currentFormData
      });
    } else {
      navigate(-1);
    }
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
        phone: sanitizePhoneNumber(newCustomer.phone_number),
        email: newCustomer.email.trim() || null,
        warehouse: currentWarehouse.id,
      };

      console.log('Ã°Å¸â€™Â¾ Saving customer to warehouse:', currentWarehouse.id, customerData);

      let response;
      if (isEdit) {
        response = await api.patch(`customers/${editingCustomer.id}/`, customerData);
        console.log("Ã¢Å“â€¦ Customer updated:", response.data);
        
        updateCustomersList(prev => prev.map(customer => 
          customer.id === editingCustomer.id ? response.data : customer
        ));
        
        showAlert("Customer updated successfully!", "success");
      } else {
        response = await api.post("customers/", customerData);
        console.log("Ã¢Å“â€¦ New customer created:", response.data);
        
        updateCustomersList(prev => {
          const exists = prev.some(customer => customer.id === response.data.id);
          return exists ? prev : [response.data, ...prev];
        });
        
        if (embedded) {
          showAlert("Customer registered successfully!", "success");
          resetForm();
          handleSelectCustomer(response.data);
          return;
        }
        
        if (cameFromMerchandisingSale) {
          console.log("Ã°Å¸â€â€ž Returning to MerchandisingSale with new customer:", response.data);
          
          // Navigate back to merchandising sale with the new customer data
          navigate(location.state.returnPath || '/merchandising-sale', {
            state: {
              ...location.state.currentFormData,
              newlyCreatedCustomer: response.data,
              autoSelectCustomer: true
            }
          });
          return;
        }
        
        showAlert("Customer registered successfully!", "success");
      }
      
      resetForm();
      
    } catch (error) {
      console.error("Ã¢ÂÅ’ Error saving customer:", error);
      
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
      phone_number: sanitizePhoneNumber(customer.phone || ""),
      email: customer.email || "",
    });
    setCustomerErrors({});
    
    if (embedded) {
      document.querySelector(".customer-registration-drawer-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleDelete = async (customer) => {
    showConfirmDialog(
      `Are you sure you want to delete "${customer.name}"? This action cannot be undone.`,
      async () => {
        setIsDeleting(customer.id);
        try {
          await api.delete(`customers/${customer.id}/`);
          console.log("Ã¢Å“â€¦ Customer deleted:", customer.name);
          
          updateCustomersList(prev => prev.filter(c => c.id !== customer.id));
          
          showAlert("Customer deleted successfully!", "success");
        } catch (error) {
          console.error("Ã¢ÂÅ’ Error deleting customer:", error);
          showAlert("Failed to delete customer. Please try again.");
        } finally {
          setIsDeleting(null);
        }
      }
    );
  };

  const handleContinueToSale = () => {
    // Check if we have form data to restore
    const formDataToRestore = location.state?.currentFormData || {};
    
    navigate("/merchandising-sale", {
      state: {
        transactionTypeName: "Warehouse",
        selectedTransactionTypeName: "Warehouse",
        ...formDataToRestore,
      }
    });
  };

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const list = customers.filter(customer =>
      customer.name?.toLowerCase().includes(term) ||
      customer.phone?.toLowerCase().includes(term)
    );

    return [...list].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [customers, searchTerm]);

  const fieldClass = (hasError) =>
    `w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60 bg-white dark:bg-slate-800/80 dark:text-white transition-colors ${
      hasError ? "border-red-500 dark:border-red-500" : "border-gray-300 dark:border-slate-600"
    }`;

  const loadingOrErrorContent = warehouseLoading ? (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading warehouse information...</p>
      </div>
    </div>
  ) : !currentWarehouse ? (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="text-red-500 mb-4">
          <svg className="w-14 h-14 mx-auto" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Warehouse Not Found</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">No warehouse is assigned to your account.</p>
        <button onClick={handleExit} className="btn btn-back">Back</button>
      </div>
    </div>
  ) : null;

  const content = (
    <div className={embedded ? "h-full flex flex-col" : "customer-registration-page__body"}>
      <div className={embedded ? "mb-6 border-b border-gray-200 pb-4 dark:border-slate-700" : "customer-registration-page__header"}>
        <div className={embedded ? "flex items-start justify-between gap-4" : "customer-registration-page__header-row"}>
          <div>
            <h1
              className={
                embedded
                  ? "text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl"
                  : "customer-registration-page__title"
              }
            >
              {!embedded && (
                <FaUserFriends className="customer-registration-page__title-icon" aria-hidden="true" />
              )}
              <span>{panelModeTitle}</span>
            </h1>
            <p className={embedded ? "mt-2 text-gray-600 dark:text-gray-400" : "customer-registration-page__subtitle"}>{panelModeSubtitle}</p>
            <div className={embedded ? "mt-3 flex flex-wrap gap-2" : "customer-registration-page__chips"}>
              <span className="inline-flex items-center rounded-full border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-gray-700 dark:text-slate-200">
                Warehouse: {currentWarehouse?.name || "Loading..."}
              </span>
              {saleContext?.mspNo && (
                <span className="inline-flex items-center rounded-full border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-900/20 px-3 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-300">
                  MSP: {saleContext.mspNo}
                </span>
              )}
              {saleContext?.transactionTypeName && (
                <span className="inline-flex items-center rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  {saleContext.transactionTypeName}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleExit}
            className={embedded ? "btn btn-back px-4 py-2 self-start" : "btn btn-back customer-registration-page__back-btn"}
            type="button"
          >
            {cameFromMerchandisingSale ? "Back to Sale" : "Back"}
          </button>
        </div>
      </div>

      {loadingOrErrorContent || (
        <>
          {successMessage && (
            <div className={embedded ? "mb-4 rounded-xl border border-emerald-300/60 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-900/20 dark:text-emerald-200" : "customer-registration-page__notice"}>
              {successMessage}
            </div>
          )}

          <div className={embedded ? "grid flex-1 min-h-0 gap-6 lg:grid-cols-[1.05fr_1.1fr]" : "customer-registration-page__grid"}>
            <div className={embedded ? "rounded-2xl border border-gray-200 bg-white p-5 shadow-lg dark:border-slate-700 dark:bg-slate-900/90 sm:p-6" : "customer-registration-page__panel customer-registration-page__panel--form"}>
              <div className="flex items-center justify-between mb-5 gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {editingCustomer ? "Edit Customer" : "Register New Customer"}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {editingCustomer ? "Update details then save changes." : "Create a customer and auto-use it in this sale."}
                  </p>
                </div>
                {editingCustomer && (
                  <button onClick={resetForm} className="btn btn-cancel" type="button">
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
                    className={fieldClass(customerErrors.name)}
                    placeholder="Enter customer name"
                  />
                  {customerErrors.name && <p className="text-red-500 text-xs mt-1">{customerErrors.name}</p>}
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
                    className={`${fieldClass(customerErrors.address)} resize-none`}
                    placeholder="Street, Barangay, City, Province"
                  />
                  {customerErrors.address && <p className="text-red-500 text-xs mt-1">{customerErrors.address}</p>}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
<label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="text"
                      id="phone_number"
                      name="phone_number"
                      inputMode="numeric"
                      pattern="[0-9]{11}"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      maxLength={11}                      
                      value={newCustomer.phone_number}
                      onChange={handleInputChange}
                      className={fieldClass(customerErrors.phone_number)}
                      placeholder="09xx-xxx-xxxx"
                    />
                    {customerErrors.phone_number && <p className="text-red-500 text-xs mt-1">{customerErrors.phone_number}</p>}
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
                      className={fieldClass(customerErrors.email)}
                      placeholder="customer@example.com"
                    />
                    {customerErrors.email && <p className="text-red-500 text-xs mt-1">{customerErrors.email}</p>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-3">
                  <button type="submit" disabled={isLoading} className="flex-1 min-w-[200px] btn btn-primary">
                    {isLoading
                      ? (editingCustomer ? "Updating..." : "Saving...")
                      : editingCustomer
                        ? "Update Customer"
                        : cameFromMerchandisingSale
                          ? "Save & Use Customer"
                          : "Register Customer"}
                  </button>

                  {!editingCustomer && !cameFromMerchandisingSale && (
                    <button type="button" onClick={handleContinueToSale} className="btn btn-add">
                      Continue to Sale
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className={embedded ? "flex min-h-[320px] flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-lg dark:border-slate-700 dark:bg-slate-900/90 sm:p-6" : "customer-registration-page__panel customer-registration-page__panel--list"}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Registered Customers ({customers.length})
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Search, select, edit, or remove existing customers.
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={fieldClass(false)}
                />
              </div>

              <div className={`space-y-3 overflow-y-auto pr-1 ${embedded ? "flex-1 min-h-0 max-h-none" : "max-h-[460px]"}`}>
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className={
                        embedded
                          ? `rounded-xl border p-3 transition-colors ${
                              editingCustomer?.id === customer.id
                                ? "border-cyan-300 bg-cyan-50 dark:border-cyan-700 dark:bg-cyan-900/20"
                                : "border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                            }`
                          : `customer-registration-page__list-card ${
                              editingCustomer?.id === customer.id
                                ? "customer-registration-page__list-card--active"
                                : ""
                            }`
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-900 dark:text-white truncate">{customer.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">{customer.phone || "No phone"}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{customer.address || "No address"}</div>
                          {customer.email && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{customer.email}</div>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                          {cameFromMerchandisingSale && (
                            <button
                              type="button"
                              onClick={() => handleSelectCustomer(customer)}
                              className="btn btn-add text-xs"
                              disabled={isLoading}
                              title="Use this customer for current sale"
                            >
                              Use
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEdit(customer)}
                            className="btn btn-edit text-xs"
                            disabled={isLoading}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
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
                  <div className="flex-1 grid place-items-center rounded-xl border border-dashed border-gray-300 dark:border-slate-600 p-8 text-center">
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {searchTerm ? "No customers found" : "No customers registered yet"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {searchTerm ? "Try another name or phone number." : "Create your first customer on the left form."}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (embedded) {
    const drawerIsShown = isDrawerVisible && !isClosing;

    return createPortal(
      <div
        className={`fixed inset-0 z-[1200] p-3 sm:p-6 transition-all duration-200 ease-out motion-reduce:transition-none ${
          drawerIsShown
            ? "opacity-100 bg-black/70 backdrop-blur-sm"
            : "opacity-0 bg-black/0 backdrop-blur-none"
        }`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            onClose?.();
          }
        }}
      >
        <div className="ml-auto h-full w-full max-w-6xl">
          <div
            className={`h-full rounded-2xl border border-white/10 bg-white dark:bg-slate-950 shadow-2xl overflow-hidden transform-gpu transition-all duration-200 ease-out motion-reduce:transition-none ${
              drawerIsShown ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0"
            }`}
          >
            <div className="customer-registration-drawer-scroll h-full overflow-y-auto p-4 sm:p-6">
              {content}
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className="page customer-registration-page">
      <div className="customer-registration-page__content">{content}</div>
    </div>
  );
};

export default CustomerRegistration;
