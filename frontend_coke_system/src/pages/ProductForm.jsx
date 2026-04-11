// ProductForm.jsx - WITH IMPROVED INLINE ADD (NO NOTIFICATIONS)
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { notifyProductChange } from "../utils/productNotifier";
import { getCurrentWarehouse, getWarehouseAxiosConfig } from "../utils/warehouseUtils";
import "../styles/pages/productform.scss";
import api from "../api";

const ProductForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
 
  // Get the state data passed from receiving form
  const { preSelectedSupplier, returnTo, message, savedFormState } = location.state || {};
 
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
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
  const [showAddNewInput, setShowAddNewInput] = useState({});
  const [newCategoryInput, setNewCategoryInput] = useState({});
  const [newShellInput, setNewShellInput] = useState({});
  const [newContentInput, setNewContentInput] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState({
    open: false,
    type: "success",
    text: "",
  });

  useEffect(() => {
    const warehouse = getCurrentWarehouse();
    setCurrentWarehouse(warehouse);
    console.log('🏭 Current warehouse set:', warehouse);
   
    fetchDropdowns();
    generateSystemCode(0);
  }, []);

  // NEW: Pre-fill supplier if passed from receiving form
  useEffect(() => {
    if (preSelectedSupplier && suppliers.length > 0) {
      console.log('🔄 Pre-filling supplier:', preSelectedSupplier);
      setRows(prev => {
        const newRows = [...prev];
        newRows[0].supplier = preSelectedSupplier.id;
        // Regenerate system code with supplier prefix
        setTimeout(() => generateSystemCode(0, preSelectedSupplier.id), 100);
        return newRows;
      });
    }
  }, [preSelectedSupplier, suppliers]);

  // NEW: Show message if passed from receiving form
  useEffect(() => {
    if (message) {
      showNotice(message, "info");
    }
  }, [message]);

  const fetchDropdowns = () => {
    api.get("/product-categories/").then((res) => setCategories(res.data));
    api.get("/shelltypes/").then((res) => setShellTypes(res.data));
    api.get("/contenttypes/").then((res) => setContentTypes(res.data));
    api.get("/suppliers/").then((res) => setSuppliers(res.data));
  };

// ✅ CHANGE: use supplier's official SUP code as base for system_code
//updateeeee
const getSupplierBaseCode = (supplier) => {
  if (!supplier) return "PROD";

  // Use supplier's official SUP code (e.g., "SUP-024EF1")
  const supCode =
    supplier?.supplier_code ||      // primary: official SUP code
    supplier?.sup_code ||
    supplier?.code ||
    supplier?.registration_number ||
    "";

  // Clean + normalize
  const cleaned = String(supCode).trim().toUpperCase();

  // Return cleaned SUP code or fallback to "PROD" if empty
  return cleaned || "PROD";
};

// ✅ CHANGE: create short unique suffix
const generateProductSuffix = () => {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4 chars
  const time = Date.now().toString().slice(-2); // last 2 digits
  return `${random}${time}`; // ex: "A9K212"
};
// ✅ CHANGE: generate unique supplier prefix from official SUP code
  // ✅ Enhanced system code generation with smart prefixes
  
// ✅ CHANGE: system_code now starts with supplier SUP code (ex: SUP-024EF1-XXXX)
const generateSystemCode = (index, supplierId = null) => {
  const supplier = suppliers.find((s) => String(s.id) === String(supplierId));
  const baseCode = getSupplierBaseCode(supplier); // <-- SUP-024EF1
  const suffix = generateProductSuffix();         // <-- random+time
  const code = `${baseCode}-${suffix}`;

  setRows((prev) => {
    const newRows = [...prev];
    newRows[index].system_code = code;
    return newRows;
  });
};


  // ✅ Helpefr function to get supplier name and show prefix info
 // ✅ CHANGE: now returns supplier SUP code as "prefix/base"
const getSupplierInfo = (supplierId) => {
  const supplier = suppliers.find((s) => String(s.id) === String(supplierId));
  if (!supplier) return { name: "", prefix: "" };

  const base = getSupplierBaseCode(supplier);
  return {
    name: supplier.company_name,
    prefix: base, // now this is "SUP-024EF1"
  };
};

//update changeeeeeeeeeeees


  const handleImageUpload = (index, e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showNotice('Please select a valid image file.', 'error');
        return;
      }
     
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
   
    // Handle "Add new" option selection
    if (value === "ADD_NEW_CATEGORY" || value === "ADD_NEW_SHELL" || value === "ADD_NEW_CONTENT") {
      const key = `${name}_${index}`;
      setShowAddNewInput(prev => ({ ...prev, [key]: true }));
      return;
    }
   
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
     
      // Regenerate system code when supplier changes
      if (name === "supplier" && value) {
        setTimeout(() => generateSystemCode(index, value), 100);
      }
     
      return newRows;
    });
   
    setValidationErrors(prev => prev.filter(error => !(error.rowIndex === index && error.field === name)));
    checkAndAddRow(index);
  };

  // ✅ UPDATED: Silent inline add new functions (no notifications)
  const handleInlineAddNew = async (type, rowIndex, value) => {
    if (!value.trim()) return;

    let endpoint = "";
    let payload = {};
    let fieldName = "";

    if (type === "category") {
      endpoint = "product-categories/";
      payload = { name: value };
      fieldName = "product_category";
    } else if (type === "shell") {
      endpoint = "shelltypes/";
      payload = { description: value };
      fieldName = "shell_type";
    } else if (type === "content") {
      endpoint = "contenttypes/";
      payload = { description: value };
      fieldName = "content_type";
    }

    try {
      const res = await api.post(`/${endpoint}`, payload);
      fetchDropdowns();
      setRows((prev) => {
        const newRows = [...prev];
        newRows[rowIndex][fieldName] = res.data.id;
        return newRows;
      });
     
      // Clear the input and hide add new input
      const key = `${fieldName}_${rowIndex}`;
      setShowAddNewInput(prev => ({ ...prev, [key]: false }));
     
      if (type === "category") {
        setNewCategoryInput(prev => ({ ...prev, [rowIndex]: "" }));
      } else if (type === "shell") {
        setNewShellInput(prev => ({ ...prev, [rowIndex]: "" }));
      } else if (type === "content") {
        setNewContentInput(prev => ({ ...prev, [rowIndex]: "" }));
      }
     
      // ✅ REMOVED: No more notifications for inline additions
    } catch (err) {
      console.error("❌ Add New Error:", err.response?.data || err.message);
      // Only show error notifications, not success ones
      showNotice("❌ Failed to add new item", "error");
    }
  };

  const checkAndAddRow = (index) => {
    const current = rows[index];
    const filled =
      current.supplier &&
      current.supplier_code &&
      current.product_name &&
      current.product_category &&
      current.purchase_price &&
      current.content_no;
    if (filled && index === rows.length - 1) {
      setRows((prev) => {
        const newRows = [
          ...prev,
          {
            system_code: "",
            supplier_code: "",
            supplier: "",
            product_name: "",
            product_category: "",
            returnable: true,
            purchase_price: "0",
            selling_price: "0",
            shell_price: "0",
            bottle_price: "0",
            content_no: "",
            shell_type: "",
            content_type: "",
            image: null,
            imagePreview: null
          },
        ];
        setTimeout(() => {
          generateSystemCode(newRows.length - 1);
          inputRefs.current[newRows.length - 1]?.focus();
        }, 100);
        return newRows;
      });
    }
  };

  const showNotice = (text, type = "success") => {
    setNotice({ open: true, type, text });
   
    let timeout = 1000;
    if (type === "info") {
      timeout = 800;
    } else if (type === "error") {
      timeout = 2000;
    }
   
    setTimeout(() => {
      setNotice({ open: false, type: "success", text: "" });
    }, timeout);
  };

  const validateForm = () => {
    const errors = [];
    const filledRows = rows.filter(row => row.product_name.trim() !== "");
   
    if (filledRows.length === 0) {
      showNotice("❌ Please fill at least one product row before saving.", "error");
      return false;
    }

    filledRows.forEach((row, index) => {
      const actualIndex = rows.findIndex(r => r === row);
     
      const requiredFields = [
        { field: 'supplier', label: 'Supplier' },
        { field: 'supplier_code', label: 'Supplier Product Code' },
        { field: 'product_name', label: 'Product Name' },
        { field: 'product_category', label: 'Product Category' },
        { field: 'purchase_price', label: 'Purchase Price (Pcs.)' },
        { field: 'content_no', label: 'Quantity (Pcs.)' },
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

      if (row.returnable === true) {
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
            message: `Empty bottle price must be a valid positive number in row ${actualIndex + 1}`
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

  const hasFieldError = (rowIndex, fieldName) => {
    return validationErrors.some(error => error.rowIndex === rowIndex && error.field === fieldName);
  };

  const persistCreatedProductNotifications = (createdProducts) => {
    if (createdProducts.length === 0) {
      return;
    }

    try {
      console.log('📦 Products created successfully:', createdProducts.length);
      console.log('🏭 Notifying ONLY current warehouse users:', currentWarehouse?.name);

      createdProducts.forEach((product) => {
        const categoryName =
          categories.find((c) => c.id.toString() === product.formData.product_category.toString())?.name ||
          'Unknown';
        const supplierInfo = getSupplierInfo(product.formData.supplier);

        const notificationData = {
          action: 'created',
          id: product.id,
          product_name: product.formData.product_name,
          product_code: product.formData.system_code,
          category: categoryName,
          selling_price: product.formData.selling_price,
          warehouse_id: currentWarehouse.id,
          warehouseId: currentWarehouse.id,
          targetWarehouse: currentWarehouse.id,
          restrictToWarehouse: true,
          source_warehouse: {
            id: currentWarehouse.id,
            name: currentWarehouse.name
          },
          metadata: {
            supplier_code: product.formData.supplier_code,
            supplier_name: supplierInfo.name,
            supplier_prefix: supplierInfo.prefix,
            purchase_price: product.formData.purchase_price,
            returnable: product.formData.returnable,
            created_at: new Date().toISOString(),
            event_timestamp: Date.now(),
            persist_immediate: true
          }
        };

        // Best-effort notification dispatch; save should not fail if this side effect fails.
        try {
          notifyProductChange(notificationData);
        } catch (notificationError) {
          console.error('Non-blocking product notification error:', notificationError);
        }

        setTimeout(() => {
          try {
            const warehouseKey = `persistedNotifications_warehouse_${currentWarehouse.id}`;
            const existingNotifications = JSON.parse(localStorage.getItem(warehouseKey) || '[]');

            const persistentNotification = {
              id: `product_created_${product.id}_${Date.now()}`,
              type: 'product_created',
              category: 'products',
              title: '📦 New Product Added',
              message: `${product.formData.product_name} from ${supplierInfo.name} (${supplierInfo.prefix}) has been added`,
              details: `Product Code: ${product.formData.system_code}`,
              priority: 'medium',
              timestamp: new Date().toISOString(),
              is_read: false,
              data: {
                id: product.id,
                product_name: product.formData.product_name,
                product_code: product.formData.system_code,
                category: categoryName,
                selling_price: product.formData.selling_price,
                warehouse_id: currentWarehouse.id,
                created_at: new Date().toISOString(),
                supplier_code: product.formData.supplier_code,
                supplier_name: supplierInfo.name,
                supplier_prefix: supplierInfo.prefix,
                purchase_price: product.formData.purchase_price,
                returnable: product.formData.returnable
              }
            };

            const updatedNotifications = [persistentNotification, ...existingNotifications];
            const trimmedNotifications = updatedNotifications.slice(0, 50);
            localStorage.setItem(warehouseKey, JSON.stringify(trimmedNotifications));

            console.log(`💾 IMMEDIATE SAVE: Product notification persisted for ${product.formData.product_name} with prefix ${supplierInfo.prefix}`);
          } catch (error) {
            console.error('❌ Failed to immediately persist product notification:', error);
          }
        }, 200);

        console.log(`📦 Product notification sent for: ${product.formData.product_name} from ${supplierInfo.name} (${supplierInfo.prefix})`);
      });
    } catch (postSaveError) {
      console.error('Non-blocking post-save product side effect error:', postSaveError);
    }
  };

  const navigateAfterSave = (createdProducts) => {
    try {
      if (returnTo) {
        const firstCreatedProduct = createdProducts[0];
        const supplierInfo = getSupplierInfo(firstCreatedProduct.formData.supplier);
        const navigationState = {
          refreshProducts: true,
          newProduct: {
            id: firstCreatedProduct.id,
            name: firstCreatedProduct.formData.product_name,
            supplier_id: firstCreatedProduct.formData.supplier,
            supplier_name: supplierInfo.name,
            supplier_prefix: supplierInfo.prefix
          }
        };

        if (savedFormState) {
          navigationState.savedFormState = savedFormState;
        }

        navigate(returnTo, { state: navigationState, replace: true });
        return;
      }

      navigate("/products", { replace: true });
    } catch (navigationError) {
      console.error("Post-save navigation error:", navigationError);
      navigate("/products", { replace: true });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSaving) {
      return;
    }

    setValidationErrors([]);

    if (!validateForm()) {
      return;
    }

    if (!currentWarehouse || !currentWarehouse.id) {
      showNotice("No warehouse assigned. Please contact administrator.", "error");
      return;
    }

    setIsSaving(true);

    try {
      const filledRows = rows.filter(row => row.product_name.trim() !== "");
      let createdProducts = [];
     
      for (let formData of filledRows) {
        const pricingRes = await api.post("/pricing/", {
          purchase_price: parseFloat(formData.purchase_price) || 0,
          selling_price: parseFloat(formData.selling_price) || 0,
          shell_price: parseFloat(formData.shell_price) || 0,
          bottle_price: parseFloat(formData.bottle_price) || 0,
        });

        const unitTypeRes = await api.post("/unit-types/", {
          content_no: parseInt(formData.content_no) || 0,
          returnable: formData.returnable,
          shell_type: formData.shell_type,
          content_type: formData.content_type,
          content_returnable: formData.returnable,
        });

        const productData = new FormData();
        productData.append('system_code', formData.system_code);
        productData.append('supplier_code', formData.supplier_code);
        productData.append('supplier', formData.supplier);
        productData.append('product_name', formData.product_name);
        productData.append('product_category', formData.product_category);
        productData.append('unit_type', unitTypeRes.data.id);
        productData.append('price', pricingRes.data.id);
        productData.append('warehouse', currentWarehouse.id);
       
        if (formData.image) {
          productData.append('image', formData.image);
        }

        const warehouseConfig = getWarehouseAxiosConfig(currentWarehouse);
        const productResponse = await api.post("/products/", productData, {
          headers: {
            ...warehouseConfig.headers
          },
        });

        if (productResponse.data) {
          createdProducts.push({
            ...productResponse.data,
            formData: formData
          });
        }
      }

      if (createdProducts.length === 0) {
        showNotice("No products were created. Please try again.", "error");
        return;
      }

      persistCreatedProductNotifications(createdProducts);
      navigateAfterSave(createdProducts);
    } catch (err) {
      console.log("Form values when saving:", rows);
      console.error("Save Error:", err.response?.data || err.message);
      const rawErrorData = err.response?.data;
      const backendMessage =
        typeof rawErrorData === "string"
          ? (rawErrorData.trim().startsWith("<!DOCTYPE") || rawErrorData.trim().startsWith("<html")
              ? "Server error while uploading image. Please check backend logs."
              : rawErrorData)
          : rawErrorData?.message || rawErrorData?.detail;
      showNotice("Error saving products: " + (backendMessage || err.message), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (returnTo && savedFormState) {
      navigate(returnTo, {
        state: {
          savedFormState: savedFormState,
          message: "Product creation cancelled - returning to receiving form",
          refreshProducts: false
        }
      });
    } else if (returnTo) {
      navigate(returnTo);
    } else {
      navigate("/products");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="page pf-form">
      <div className="page-header">
        <h2 className="page-title">
          Product Form
          {currentWarehouse && (
            <span className="page-warehouse-chip page-warehouse-chip--inline">
              <span className="page-warehouse-chip__icon" aria-hidden="true">📍</span>
              <span className="page-warehouse-chip__text">{currentWarehouse.name}</span>
            </span>
          )}
          {returnTo && (
            <span style={{
              fontSize: '12px',
              fontWeight: 'normal',
              color: '#059669',
              marginLeft: '8px',
              background: '#f0fdf4',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid #bbf7d0'
            }}>
              ℹ️ Adding new product for {preSelectedSupplier?.name || 'Receiving Form'}
            </span>
          )}
        </h2>
      </div>

      {!currentWarehouse && (
        <div className="card" style={{ marginBottom: '20px', padding: '16px', borderLeft: '4px solid #f59e0b', backgroundColor: '#fef3c7' }}>
          <p style={{ color: '#92400e', margin: '0', fontWeight: '500' }}>
            ⚠️ Warning: No warehouse detected. Products may not be saved correctly.
          </p>
        </div>
      )}

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

      <div className="card pf-scroll">
        <table className="table table-hover">
          <thead>
            <tr>
              {[
                "Supplier*",
                "Supplier Product Code*",
                "System Product Code",
                "Product Name*",
                "Product Category*",
                "Return Required",
                "Purchase Price (Pcs.)*",
                "Shell Price",
                "Empty Bottle/s Price",
                "Shell Type*",
                "Quantity (Pcs.)*",
                "Content Type*",
                "Selling Price",
                "Image",
              ].map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const supplierInfo = getSupplierInfo(row.supplier);
             
              return (
                <tr key={index}>
                  {/* Supplier */}
                  <td style={{ minWidth: '80px' }}>
                    <select
                      name="supplier"
                      value={row.supplier || ""}
                      onChange={(e) => handleChange(index, e)}
                      className={`pf-select ${hasFieldError(index, 'supplier') ? 'pf-input-error' : ''}`}
                      style={{
                        backgroundColor: preSelectedSupplier && index === 0 ? '#f0fdf4' : '',
                        border: preSelectedSupplier && index === 0 ? '2px solid #bbf7d0' : ''
                      }}
                    >
                      <option value="">-- Select Supplier --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.company_name}
                        </option>
                      ))}
                    </select>
                    {row.supplier && (
                      <div style={{
                        fontSize: '10px',
                        color: '#059669',
                        marginTop: '2px',
                        fontWeight: '600'
                      }}>
                      </div>
                    )}
                  </td>

                  {/* Supplier Product Code */}
                  <td>
                    <input
                      ref={(el) => (inputRefs.current[index] = el)}
                      name="supplier_code"
                      value={row.supplier_code}
                      onChange={(e) => handleChange(index, e)}
                      className={`pf-input ${hasFieldError(index, 'supplier_code') ? 'pf-input-error' : ''}`}
                      placeholder="Supplier product code"
                    />
                  </td>

                  {/* System Product Code */}
                  <td style={{ minWidth: '80px'}}>
                    {row.supplier ? (
                      <input
                      name="system_code"
                      value={row.system_code}
                      readOnly
                      className="pf-input pf-readonly"
                    />
                    ) : (
                      <div
                      style={{
                        height: '80px',
                        display: 'flex',
                        alignItems: 'Center',
                        color: '#9ca3af',
                        fontSize: '12px',
                      }}>
                        Select supplier first
                      </div>
                    )}
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
                    {row.supplier && row.product_name && (
                      <div style={{
                        fontSize: '10px',
                        color: '#059669',
                        marginTop: '2px',
                        fontWeight: '500'
                      }}>
                      </div>
                    )}
                  </td>

                  {/* ✅ UPDATED: Product Category - No notifications, save on blur/enter */}
                  <td>
                    <div style={{ position: 'relative' }}>
                      {!showAddNewInput[`product_category_${index}`] ? (
                        <select
                          name="product_category"
                          value={row.product_category}
                          onChange={(e) => handleChange(index, e)}
                          className={`pf-select ${hasFieldError(index, 'product_category') ? 'pf-input-error' : ''}`}
                        >
                          <option value="">-- Select --</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                          <option value="ADD_NEW_CATEGORY" style={{ fontStyle: 'italic', color: '#059669' }}>
                            ➕ Add new...
                          </option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={newCategoryInput[index] || ""}
                          onChange={(e) => setNewCategoryInput(prev => ({ ...prev, [index]: e.target.value }))}
                          placeholder="Type category name..."
                          className="pf-input"
                          autoFocus
                          onBlur={(e) => {
                            if (e.target.value.trim()) {
                              handleInlineAddNew("category", index, e.target.value.trim());
                            } else {
                              setShowAddNewInput(prev => ({ ...prev, [`product_category_${index}`]: false }));
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (e.target.value.trim()) {
                                handleInlineAddNew("category", index, e.target.value.trim());
                              }
                            }
                            if (e.key === "Escape") {
                              setShowAddNewInput(prev => ({ ...prev, [`product_category_${index}`]: false }));
                              setNewCategoryInput(prev => ({ ...prev, [index]: "" }));
                            }
                          }}
                        />
                      )}
                    </div>
                  </td>

                  {/* Return Required field */}
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

                  {/* Purchase Price */}
                  <td>
                    <input
                      type="number"
                      name="purchase_price"
                      value={row.purchase_price}
                      onChange={(e) => handleChange(index, e)}
                      className={`pf-input ${hasFieldError(index, 'purchase_price') ? 'pf-input-error' : ''}`}
                      placeholder="Purchase price (Pcs.)"
                    />
                  </td>

                  {/* Shell Price */}
                  <td>
                    <input
                      type="number"
                      name="shell_price"
                      value={row.shell_price}
                      onChange={(e) => handleChange(index, e)}
                      className={`pf-input ${hasFieldError(index, 'shell_price') ? 'pf-input-error' : ''}`}
                      style={{
                        backgroundColor: row.returnable === false ? '#f3f4f6' : '',
                        color: row.returnable === false ? '#9ca3af' : '',
                        cursor: row.returnable === false ? 'not-allowed' : 'text',
                        border: row.returnable === false ? '1px solid #d1d5db' : ''
                      }}
                      placeholder="Shell price"
                      disabled={row.returnable === false}
                    />
                  </td>

                  {/* Empty Bottle Price */}
                  <td>
                    <input
                      type="number"
                      name="bottle_price"
                      value={row.bottle_price}
                      onChange={(e) => handleChange(index, e)}
                      className={`pf-input ${hasFieldError(index, 'bottle_price') ? 'pf-input-error' : ''}`}
                      style={{
                        backgroundColor: row.returnable === false ? '#f3f4f6' : '',
                        color: row.returnable === false ? '#9ca3af' : '',
                        cursor: row.returnable === false ? 'not-allowed' : 'text',
                        border: row.returnable === false ? '1px solid #d1d5db' : ''
                      }}
                      placeholder="Empty bottle price"
                      disabled={row.returnable === false}
                    />
                  </td>

                  {/* ✅ UPDATED: Shell Type - No notifications, save on blur/enter */}
                  <td>
                    <div style={{ position: 'relative' }}>
                      {!showAddNewInput[`shell_type_${index}`] ? (
                        <select
                          name="shell_type"
                          value={row.shell_type}
                          onChange={(e) => handleChange(index, e)}
                          className={`pf-select ${hasFieldError(index, 'shell_type') ? 'pf-input-error' : ''}`}
                        >
                          <option value="">-- Select --</option>
                          {shellTypes.map((shell) => (
                            <option key={shell.id} value={shell.id}>
                              {shell.description}
                            </option>
                          ))}
                          <option value="ADD_NEW_SHELL" style={{ fontStyle: 'italic', color: '#059669' }}>
                            ➕ Add new...
                          </option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={newShellInput[index] || ""}
                          onChange={(e) => setNewShellInput(prev => ({ ...prev, [index]: e.target.value }))}
                          placeholder="Type shell type..."
                          className="pf-input"
                          autoFocus
                          onBlur={(e) => {
                            if (e.target.value.trim()) {
                              handleInlineAddNew("shell", index, e.target.value.trim());
                            } else {
                              setShowAddNewInput(prev => ({ ...prev, [`shell_type_${index}`]: false }));
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (e.target.value.trim()) {
                                handleInlineAddNew("shell", index, e.target.value.trim());
                              }
                            }
                            if (e.key === "Escape") {
                              setShowAddNewInput(prev => ({ ...prev, [`shell_type_${index}`]: false }));
                              setNewShellInput(prev => ({ ...prev, [index]: "" }));
                            }
                          }}
                        />
                      )}
                    </div>
                  </td>

                  {/* Quantity */}
                  <td style= {{ minWidth: '20px' }}>
                    <input
                      type="number"
                      name="content_no"
                      value={row.content_no}
                      onChange={(e) => handleChange(index, e)}
                      className={`pf-input ${hasFieldError(index, 'content_no') ? 'pf-input-error' : ''}`}
                      placeholder="Quantity (Pcs.)"
                    />
                  </td>

                  {/* ✅ UPDATED: Content Type - No notifications, save on blur/enter */}
                  <td style= {{ minWidth: '20px' }}>
                    <div style={{ position: 'relative' }}>
                      {!showAddNewInput[`content_type_${index}`] ? (
                        <select
                          name="content_type"
                          value={row.content_type}
                          onChange={(e) => handleChange(index, e)}
                          className={`pf-select ${hasFieldError(index, 'content_type') ? 'pf-input-error' : ''}`}
                        >
                          <option value="">-- Select --</option>
                          {contentTypes.map((content) => (
                            <option key={content.id} value={content.id}>
                              {content.description}
                            </option>
                          ))}
                          <option value="ADD_NEW_CONTENT" style={{ fontStyle: 'italic', color: '#059669' }}>
                            ➕ Add new...
                          </option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={newContentInput[index] || ""}
                          onChange={(e) => setNewContentInput(prev => ({ ...prev, [index]: e.target.value }))}
                          placeholder="Type content type..."
                          className="pf-input"
                          autoFocus
                          onBlur={(e) => {
                            if (e.target.value.trim()) {
                              handleInlineAddNew("content", index, e.target.value.trim());
                            } else {
                              setShowAddNewInput(prev => ({ ...prev, [`content_type_${index}`]: false }));
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (e.target.value.trim()) {
                                handleInlineAddNew("content", index, e.target.value.trim());
                              }
                            }
                            if (e.key === "Escape") {
                              setShowAddNewInput(prev => ({ ...prev, [`content_type_${index}`]: false }));
                              setNewContentInput(prev => ({ ...prev, [index]: "" }));
                            }
                          }}
                        />
                      )}
                    </div>
                  </td>

                  {/* Selling Price */}
                  <td>
                    <input
                      type="number"
                      name="selling_price"
                      value={row.selling_price}
                      onChange={(e) => handleChange(index, e)}
                      className={`pf-input ${hasFieldError(index, 'selling_price') ? 'pf-input-error' : ''}`}
                      placeholder="Selling price"
                    />
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
                            fontSize: '24px',
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
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="pf-actions">
          <button
            type="button"
            className="btn btn-back"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!currentWarehouse || isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Notice Modal */}
      {notice.open && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: notice.type === "info" ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: notice.type === "info" ? 1000 : 9999
          }}
        >
          <div
            className={`modal ${notice.type === "success" ? "modal--success" : notice.type === "info" ? "modal--info" : "modal--error"}`}
            style={{
              minWidth: '320px',
              maxWidth: '450px',
              margin: '0 20px',
              padding: notice.type === "info" ? '16px 20px' : '24px 20px',
              borderRadius: '12px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: notice.type === "success" ? '3px solid #10b981' : notice.type === "info" ? '3px solid #3b82f6' : '3px solid #ef4444',
              backgroundColor: 'white'
            }}
          >
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: notice.type === "info" ? '24px' : '32px',
                marginBottom: '12px'
              }}>
                {notice.type === "success" ? "✅" : notice.type === "info" ? "ℹ️" : ""}
              </div>
              <p
                style={{
                  fontSize: '16px',
                  lineHeight: '1.5',
                  margin: '0',
                  color: notice.type === "success" ? '#065f46' : notice.type === "info" ? '#1e40af' : '#991b1b',
                  fontWeight: '600'
                }}
              >
                {notice.text}
              </p>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

export default ProductForm;

             
