// ProductForm.jsx - FIXED VERSION WITH PROPER WAREHOUSE ID PASSING
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { notifyProductChange } from "../utils/productNotifier"; // ✅ NEW IMPORT
import { getCurrentWarehouse, getWarehouseAxiosConfig } from "../utils/warehouseUtils"; // ✅ NEW IMPORT
import "../styles/pages/productform.scss";
import api from "../api"; // ✅ correct

const ProductForm = () => {
  const navigate = useNavigate();
  const [currentWarehouse, setCurrentWarehouse] = useState(null); // ✅ NEW STATE
  const [rows, setRows] = useState([
    {
      system_code: "",
      supplier_code: "",
      product_name: "",
      product_category: "",
      returnable: true,
      purchase_price: "",
      selling_price: "",
      shell_price: "",
      bottle_price: "",
      content_no: "",
      shell_type: "",
      content_type: "",
      supplier: "",
      image: null,
      imagePreview: null
    }
  ]);
  const inputRefs = useRef([]);
  const fileInputRefs = useRef([]);

  const [categories, setCategories] = useState([]);
  const [shellTypes, setShellTypes] = useState([]);
  const [contentTypes, setContentTypes] = useState([]);
  const [showModal, setShowModal] = useState({ type: null, rowIndex: null });
  const [newValue, setNewValue] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [notice, setNotice] = useState({
    open: false,
    type: "success",
    text: "",
  });

  // ✅ UPDATED: Use warehouse utilities instead of inline function
  useEffect(() => {
    const warehouse = getCurrentWarehouse();
    setCurrentWarehouse(warehouse);
    console.log('🏭 Current warehouse set:', warehouse);
    
    fetchDropdowns();
    generateSystemCode(0);
  }, []);

  const fetchDropdowns = () => {
    api.get("/product-categories/").then((res) => setCategories(res.data));
    api.get("/shelltypes/").then((res) => setShellTypes(res.data));
    api.get("/contenttypes/").then((res) => setContentTypes(res.data));
    api.get("/suppliers/").then((res) => setSuppliers(res.data));
  };

  const generateSystemCode = (index) => {
    const code = `PROD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    setRows((prev) => {
      const newRows = [...prev];
      newRows[index].system_code = code;
      return newRows;
    });
  };

  const handleImageUpload = (index, e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showNotice('Please select a valid image file.', 'error');
        return;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        showNotice('Image size should be less than 5MB.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setRows((prev) => {
          const newRows = [...prev];
          newRows[index].image = file;
          newRows[index].imagePreview = event.target.result;
          return newRows;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (index) => {
    setRows((prev) => {
      const newRows = [...prev];
      newRows[index].image = null;
      newRows[index].imagePreview = null;
      return newRows;
    });
    if (fileInputRefs.current[index]) {
      fileInputRefs.current[index].value = '';
    }
  };

  const handleChange = (index, e) => {
    const { name, value, type, checked } = e.target;
    setRows((prev) => {
      const newRows = [...prev];
      if (name === "returnable") {
        newRows[index][name] = checked;
        if (!checked) {
          newRows[index].shell_price = 0;
          newRows[index].bottle_price = 0;
        }
      } else {
        newRows[index][name] = type === "checkbox" ? checked : value;
      }
      return newRows;
    });
    
    // Clear validation errors for this field when user starts typing
    setValidationErrors(prev => prev.filter(error => !(error.rowIndex === index && error.field === name)));
    
    checkAndAddRow(index);
  };

  const handleSelectChange = (index, e, type) => {
    if (e.target.value === "add_new") {
      setShowModal({ type, rowIndex: index });
    } else {
      handleChange(index, e);
    }
  };

  const handleAddNew = async () => {
    let endpoint = "";
    let payload = {};
    let fieldName = "";

    if (showModal.type === "category") {
      endpoint = "product-categories/";
      payload = { name: newValue };
      fieldName = "product_category";
    } else if (showModal.type === "shell") {
      endpoint = "shelltypes/";
      payload = { description: newValue };
      fieldName = "shell_type";
    } else if (showModal.type === "content") {
      endpoint = "contenttypes/";
      payload = { description: newValue };
      fieldName = "content_type";
    }

    try {
      const res = await api.post(`/${endpoint}`, payload);
      fetchDropdowns();
      setRows((prev) => {
        const newRows = [...prev];
        newRows[showModal.rowIndex][fieldName] = res.data.id;
        return newRows;
      });
      setShowModal({ type: null, rowIndex: null });
      setNewValue("");
    } catch (err) {
      console.error("❌ Add New Error:", err.response?.data || err.message);
      showNotice("❌ Failed to add new item", "error");
    }
  };

  const checkAndAddRow = (index) => {
    const current = rows[index];
    const filled =
      current.supplier_code &&
      current.product_name &&
      current.product_category &&
      current.purchase_price &&
      current.selling_price &&
      current.content_no;
    if (filled && index === rows.length - 1) {
      setRows((prev) => {
        const newRows = [
          ...prev,
          {
            system_code: `PROD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            supplier_code: "",
            supplier: "",
            product_name: "",
            product_category: "",
            returnable: true,
            purchase_price: "",
            selling_price: "",
            shell_price: "",
            bottle_price: "",
            content_no: "",
            shell_type: "",
            content_type: "",
            image: null,
            imagePreview: null
          },
        ];
        setTimeout(() => {
          inputRefs.current[newRows.length - 1]?.focus();
        }, 100);
        return newRows;
      });
    }
  };

  // Show notice function
  const showNotice = (text, type = "success") => {
    setNotice({ open: true, type, text });
    setTimeout(() => {
      setNotice({ open: false, type: "success", text: "" });
    }, 3000);
  };

  // Validate form before submission
  const validateForm = () => {
    const errors = [];
    const filledRows = rows.filter(row => row.product_name.trim() !== "");
    
    if (filledRows.length === 0) {
      showNotice("❌ Please fill at least one product row before saving.", "error");
      return false;
    }

    filledRows.forEach((row, index) => {
      const actualIndex = rows.findIndex(r => r === row);
      
      // Required fields validation
      const requiredFields = [
        { field: 'supplier_code', label: 'Supplier Code' },
        { field: 'product_name', label: 'Product Name' },
        { field: 'product_category', label: 'Product Category' },
        { field: 'purchase_price', label: 'Purchase Price' },
        { field: 'selling_price', label: 'Selling Price' },
        { field: 'content_no', label: 'Content No' },
        { field: 'shell_type', label: 'Shell Type' },
        { field: 'content_type', label: 'Content Type' }
      ];

      requiredFields.forEach(({ field, label }) => {
        if (!row[field] || row[field] === "") {
          errors.push({
            rowIndex: actualIndex,
            field: field,
            message: `${label} is required in row ${actualIndex + 1}`
          });
        }
      });

      // Validate numeric fields
      const numericFields = ['purchase_price', 'selling_price', 'content_no'];
      numericFields.forEach(field => {
        if (row[field] && (isNaN(row[field]) || parseFloat(row[field]) < 0)) {
          errors.push({
            rowIndex: actualIndex,
            field: field,
            message: `${field.replace('_', ' ')} must be a valid positive number in row ${actualIndex + 1}`
          });
        }
      });

      // Validate shell_price and bottle_price if returnable
      if (row.returnable) {
        if (row.shell_price && (isNaN(row.shell_price) || parseFloat(row.shell_price) < 0)) {
          errors.push({
            rowIndex: actualIndex,
            field: 'shell_price',
            message: `Shell price must be a valid positive number in row ${actualIndex + 1}`
          });
        }
        if (row.bottle_price && (isNaN(row.bottle_price) || parseFloat(row.bottle_price) < 0)) {
          errors.push({
            rowIndex: actualIndex,
            field: 'bottle_price',
            message: `Bottle price must be a valid positive number in row ${actualIndex + 1}`
          });
        }
      }
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      showNotice(`❌ Please fix ${errors.length} validation error(s) before saving.`, "error");
      return false;
    }

    return true;
  };

  // Check if field has validation error
  const hasFieldError = (rowIndex, fieldName) => {
    return validationErrors.some(error => error.rowIndex === rowIndex && error.field === fieldName);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Clear previous validation errors
    setValidationErrors([]);

    // Validate form
    if (!validateForm()) {
      return;
    }

    // ✅ UPDATED: Use warehouse utilities for better warehouse detection
    if (!currentWarehouse || !currentWarehouse.id) {
      showNotice("❌ No warehouse assigned. Please contact administrator.", "error");
      return;
    }

    try {
      const filledRows = rows.filter(row => row.product_name.trim() !== "");
      let createdProducts = []; // ✅ Track created products for notifications
      
      for (let formData of filledRows) {
        // Create pricing
        const pricingRes = await api.post("/pricing/", {
          purchase_price: parseFloat(formData.purchase_price) || 0,
          selling_price: parseFloat(formData.selling_price) || 0,
          shell_price: parseFloat(formData.shell_price) || 0,
          bottle_price: parseFloat(formData.bottle_price) || 0,
        });

        // Create unit type
        const unitTypeRes = await api.post("/unit-types/", {
          content_no: parseInt(formData.content_no) || 0,
          returnable: formData.returnable,
          shell_type: formData.shell_type,
          content_type: formData.content_type,
          content_returnable: formData.returnable,
        });

        // Prepare product data
        const productData = new FormData();
        productData.append('system_code', formData.system_code);
        productData.append('supplier_code', formData.supplier_code);
        productData.append('supplier', formData.supplier || '');
        productData.append('product_name', formData.product_name);
        productData.append('product_category', formData.product_category);
        productData.append('unit_type', unitTypeRes.data.id);
        productData.append('price', pricingRes.data.id);
        productData.append('warehouse', currentWarehouse.id); // ✅ UPDATED: Use currentWarehouse.id
        
        // Add image if exists
        if (formData.image) {
          productData.append('image', formData.image);
        }

        // ✅ UPDATED: Use warehouse config for API calls
        const warehouseConfig = getWarehouseAxiosConfig(currentWarehouse);
        const productResponse = await api.post("/products/", productData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...warehouseConfig.headers // Include warehouse headers
          },
        });

        // ✅ Track created product for notification
        if (productResponse.data) {
          createdProducts.push({
            ...productResponse.data,
            formData: formData // Keep form data for notification details
          });
        }
      }
      
      // ================================
      // 🔧 CRITICAL MODIFICATION SECTION - REPLACE THIS ENTIRE BLOCK
      // ================================
      if (createdProducts.length > 0) {
        console.log('📦 Products created successfully:', createdProducts.length);
        console.log('🏭 Notifying ONLY current warehouse users:', currentWarehouse.name); // ✅ MODIFIED: Updated message
        
        createdProducts.forEach(product => {
          const categoryName = categories.find(c => c.id.toString() === product.formData.product_category.toString())?.name || 'Unknown';
          
          // ✅ CRITICAL FIX: Only notify users in the SAME warehouse - REPLACE OLD NOTIFY CALL
          notifyProductChange({
            action: 'created',
            id: product.id,
            product_name: product.formData.product_name,
            product_code: product.formData.system_code,
            category: categoryName,
            selling_price: product.formData.selling_price,
            warehouse_id: currentWarehouse.id,
            warehouseId: currentWarehouse.id,
            // ✅ NEW FIELDS: Add these to restrict notifications to current warehouse only
            targetWarehouse: currentWarehouse.id,        // NEW: Target specific warehouse
            restrictToWarehouse: true,                   // NEW: Enable warehouse restriction
            source_warehouse: {
              id: currentWarehouse.id,
              name: currentWarehouse.name
            },
            metadata: {
              supplier_code: product.formData.supplier_code,
              purchase_price: product.formData.purchase_price,
              returnable: product.formData.returnable,
              created_at: new Date().toISOString(),
              event_timestamp: Date.now()               // NEW: Add timestamp for stale event prevention
            }
          });
          
          console.log(`📦 Product notification sent for: ${product.formData.product_name} - ONLY to ${currentWarehouse.name} users`); // ✅ MODIFIED: Updated message
        });
        
        console.log(`🔒 Notifications restricted to warehouse ${currentWarehouse.name} only`); // ✅ NEW: Added restriction confirmation
      }
      // ================================
      // END CRITICAL MODIFICATION SECTION
      // ================================
      
      showNotice(`✅ ${createdProducts.length} product(s) saved to ${currentWarehouse.name}!`, "success");
      setTimeout(() => {
        navigate("/products/");
      }, 1500);
    } catch (err) {
      console.log("Form values when saving:", rows);
      console.error("❌ Save Error:", err.response?.data || err.message);
      showNotice("❌ Error saving products: " + (err.response?.data?.message || err.message), "error");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="page pf-form">
      {/* Header */}
      <div className="page-header">
        <h2 className="page-title">
          Product Form
          {/* ✅ NEW: Show current warehouse in header */}
          {currentWarehouse && (
            <span style={{ 
              fontSize: '14px', 
              fontWeight: 'normal', 
              color: '#6b7280',
              marginLeft: '12px'
            }}>
              📍 {currentWarehouse.name}
            </span>
          )}
        </h2>
      </div>

      {/* ✅ NEW: Warehouse warning if none detected */}
      {!currentWarehouse && (
        <div className="card" style={{ marginBottom: '20px', padding: '16px', borderLeft: '4px solid #f59e0b', backgroundColor: '#fef3c7' }}>
          <p style={{ color: '#92400e', margin: '0', fontWeight: '500' }}>
            ⚠️ Warning: No warehouse detected. Products may not be saved correctly.
          </p>
        </div>
      )}

      {/* Validation Errors Summary */}
      {validationErrors.length > 0 && (
        <div className="card" style={{ marginBottom: '20px', padding: '16px', borderLeft: '4px solid #dc2626', backgroundColor: '#fef2f2' }}>
          <h4 style={{ color: '#dc2626', marginBottom: '12px' }}>Please fix the following errors:</h4>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {validationErrors.slice(0, 5).map((error, index) => (
              <li key={index} style={{ color: '#dc2626', marginBottom: '4px' }}>
                {error.message}
              </li>
            ))}
            {validationErrors.length > 5 && (
              <li style={{ color: '#dc2626', fontStyle: 'italic' }}>
                ... and {validationErrors.length - 5} more errors
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Table Card */}
      <div className="card pf-scroll">
        <table className="table table-hover">
          <thead>
            <tr>
              {[
                "System Code",
                "Supplier Code*",
                "Supplier",
                "Product Name*",
                "Product Category*",
                "Image",
                "Returnable",
                "Purchase Price*",
                "Selling Price*",
                "Shell Price",
                "Bottle Price",
                "Content No*",
                "Shell Type*",
                "Content Type*",
              ].map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {/* System Code */}
                <td>
                  <input
                    name="system_code"
                    value={row.system_code}
                    readOnly
                    className="pf-input pf-readonly"
                  />
                </td>

                {/* Supplier Code */}
                <td>
                  <input
                    ref={(el) => (inputRefs.current[index] = el)}
                    name="supplier_code"
                    value={row.supplier_code}
                    onChange={(e) => handleChange(index, e)}
                    className={`pf-input ${hasFieldError(index, 'supplier_code') ? 'pf-input-error' : ''}`}
                    placeholder="Supplier code"
                  />
                </td>

                {/* Supplier */}
                <td>
                  <select
                    name="supplier"
                    value={row.supplier || ""}
                    onChange={(e) => handleChange(index, e)}
                    className="pf-select"
                  >
                    <option value="">-- Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.company_name}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Product Name */}
                <td>
                  <input
                    name="product_name"
                    value={row.product_name}
                    onChange={(e) => handleChange(index, e)}
                    className={`pf-input ${hasFieldError(index, 'product_name') ? 'pf-input-error' : ''}`}
                    placeholder="Product name"
                  />
                </td>

                {/* Product Category */}
                <td>
                  <select
                    name="product_category"
                    value={row.product_category}
                    onChange={(e) => handleSelectChange(index, e, "category")}
                    className={`pf-select ${hasFieldError(index, 'product_category') ? 'pf-input-error' : ''}`}
                  >
                    <option value="">-- Select --</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                    <option value="add_new">+ Add New</option>
                  </select>
                </td>

                {/* Image Upload Column */}
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
                    {row.imagePreview ? (
                      <>
                        <img
                          src={row.imagePreview}
                          alt="Product preview"
                          style={{ 
                            width: '80px', 
                            height: '80px', 
                            borderRadius: '6px', 
                            objectFit: 'cover',
                            border: '2px solid #e5e7eb'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            background: '#fef2f2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <>
                        <div style={{
                          width: '80px',
                          height: '80px',
                          borderRadius: '6px',
                          background: '#f3f4f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#9ca3af',
                          fontSize: '12px',
                          border: '2px solid #e5e7eb'
                        }}>
                          📷
                        </div>
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[index]?.click()}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            background: '#f3f4f6',
                            color: '#374151',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Upload
                        </button>
                      </>
                    )}
                    <input
                      ref={(el) => (fileInputRefs.current[index] = el)}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(index, e)}
                      style={{ display: 'none' }}
                    />
                  </div>
                </td>

                {/* Returnable */}
                <td>
                  <label className="pf-check-wrap">
                    <input
                      type="checkbox"
                      name="returnable"
                      checked={row.returnable}
                      onChange={(e) => handleChange(index, e)}
                      className="pf-checkbox"
                    />
                    <span className="text">Yes</span>
                  </label>
                </td>

                {/* Numeric fields */}
                {["purchase_price", "selling_price", "shell_price", "bottle_price", "content_no"].map(
                  (field) => (
                    <td key={field}>
                      <input
                        type="number"
                        name={field}
                        value={row[field]}
                        onChange={(e) => handleChange(index, e)}
                        className={`pf-input ${hasFieldError(index, field) ? 'pf-input-error' : ''} ${
                          !row.returnable && (field === "shell_price" || field === "bottle_price") ? 'pf-input-disabled' : ''
                        }`}
                        placeholder={field.replace("_", " ")}
                        disabled={
                          !row.returnable && (field === "shell_price" || field === "bottle_price")
                        }
                      />
                    </td>
                  )
                )}

                {/* Shell Type */}
                <td>
                  <select
                    name="shell_type"
                    value={row.shell_type}
                    onChange={(e) => handleSelectChange(index, e, "shell")}
                    className={`pf-select ${hasFieldError(index, 'shell_type') ? 'pf-input-error' : ''}`}
                  >
                    <option value="">-- Select --</option>
                    {shellTypes.map((shell) => (
                      <option key={shell.id} value={shell.id}>
                        {shell.description}
                      </option>
                    ))}
                    <option value="add_new">+ Add New</option>
                  </select>
                </td>

                {/* Content Type */}
                <td>
                  <select
                    name="content_type"
                    value={row.content_type}
                    onChange={(e) => handleSelectChange(index, e, "content")}
                    className={`pf-select ${hasFieldError(index, 'content_type') ? 'pf-input-error' : ''}`}
                  >
                    <option value="">-- Select --</option>
                    {contentTypes.map((content) => (
                      <option key={content.id} value={content.id}>
                        {content.description}
                      </option>
                    ))}
                    <option value="add_new">+ Add New</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer actions */}
        <div className="pf-actions">
          <button
            type="button"
            className="btn btn-back"
            onClick={() => navigate("/products")}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={!currentWarehouse} // ✅ NEW: Disable if no warehouse
          >
            Save Product
          </button>
        </div>
      </div>

    {/* Add New Modal */}
    {showModal.type && (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-body">
            <h3 className="pf-modal-title">Add New {showModal.type.toUpperCase()}</h3>

            <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="pf-input mb-4 w-full"
            placeholder={`Enter ${showModal.type} value`}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // prevent form submit
                handleAddNew();     // add category once
              }
            }}
          />

            <div className="pf-actions">
              <button
                type="button"
                onClick={() => setShowModal({ type: null, rowIndex: null })}
                className="btn btn-cancel"
              >
                Cancel
              </button>
              <button type="button" onClick={handleAddNew} className="btn btn-add">
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

      {/* Notice Modal - Slightly Bigger & User Friendly */}
      {notice.open && (
        <div className="modal-overlay" style={{ zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
          <div 
            className={`modal ${notice.type === "success" ? "modal--success" : "modal--error"}`}
            style={{
              minWidth: '320px',
              maxWidth: '450px',
              padding: '24px 20px',
              borderRadius: '8px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
              border: notice.type === "success" ? '2px solid #10b981' : '2px solid #ef4444'
            }}
          >
            <div className="modal-body">
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '32px',
                  marginBottom: '12px'
                }}>
                  {notice.type === "success" ? "✅" : "❌"}
                </div>
                <p 
                  className="pf-modal-text" 
                  style={{
                    fontSize: '16px',
                    lineHeight: '1.5',
                    margin: '0',
                    color: notice.type === "success" ? '#065f46' : '#991b1b',
                    fontWeight: '500'
                  }}
                >
                  {notice.text}
                </p>
                {notice.type === "success" && (
                  <div style={{
                    fontSize: '13px',
                    color: '#059669',
                    marginTop: '12px',
                    fontStyle: 'italic'
                  }}>
                   
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

export default ProductForm;