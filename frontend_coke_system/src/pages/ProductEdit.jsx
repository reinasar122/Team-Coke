
// ProductEdit.jsx - COMPLETE UPDATED VERSION WITH NOTIFICATIONS
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { notifyProductChange } from "../utils/productNotifier"; // ✅ NEW IMPORT

import "../styles/pages/productedit.scss";

const ProductEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    system_code: "",
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
    price_id: null,
    unit_type_id: null,
    warehouse: null,
    image: null,
    imagePreview: null,
    currentImage: null,
    removeImage: false
  });

  // ✅ NEW: Store original data for change detection
  const [originalData, setOriginalData] = useState({});

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [shellTypes, setShellTypes] = useState([]);
  const [contentTypes, setContentTypes] = useState([]);
  const [showModal, setShowModal] = useState({ type: null });
  const [newValue, setNewValue] = useState("");
  const [suppliers, setSuppliers] = useState([]);

  const [notice, setNotice] = useState({
    open: false,
    type: "success",
    text: "",
  });

  // Warehouse helper
  const getCurrentWarehouse = () => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    if ((userData.role || "").toLowerCase() === "admin") {
      return selectedWarehouse?.id || userData.warehouse_id;
    }
    return userData.warehouse_id;
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setNotice({
          open: true,
          type: "error",
          text: "Please select a valid image file",
        });
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setNotice({
          open: true,
          type: "error",
          text: "Image size must be less than 5MB",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({
          ...prev,
          image: file,
          imagePreview: event.target.result,
          removeImage: false // Reset remove flag when new image is selected
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    // Update local state to mark image for removal
    setFormData(prev => ({
      ...prev,
      image: null,
      imagePreview: null,
      currentImage: null,
      removeImage: true // Flag to indicate image should be removed
    }));
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setNotice({
      open: true,
      type: "success",
      text: "✅ Image will be removed when you save the product!",
    });
  };

  const fetchDropdowns = async () => {
    try {
      const [categoriesRes, shellTypesRes, contentTypesRes, suppliersRes] = await Promise.all([
        axios.get("http://localhost:8080/api/product-categories/"),
        axios.get("http://localhost:8080/api/shelltypes/"),
        axios.get("http://localhost:8080/api/contenttypes/"),
        axios.get("http://localhost:8080/api/suppliers/"),
      ]);
      setCategories(categoriesRes.data);
      setShellTypes(shellTypesRes.data);
      setContentTypes(contentTypesRes.data);
      setSuppliers(suppliersRes.data);
    } catch (err) {
      console.error("Error fetching dropdowns:", err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await fetchDropdowns();

      try {
        const warehouseId = getCurrentWarehouse();
        const res = await axios.get(`http://localhost:8080/api/products/${id}/?warehouse_id=${warehouseId}`);
        const product = res.data;

        // Guard: product must belong to current warehouse
        if (product.warehouse !== warehouseId) {
          setNotice({
            open: true,
            type: "error",
            text: "⚠️ You don't have access to edit this product from another warehouse.",
          });
          setTimeout(() => navigate("/products"), 1500);
          return;
        }

        const categoryId = product.product_category?.id || product.product_category;

        const productData = {
          system_code: product.system_code || "",
          supplier_code: product.supplier_code || "",
          supplier: product.supplier || "",
          product_name: product.product_name || "",
          product_category: categoryId || "",
          returnable: product.unit_type?.returnable ?? true,
          purchase_price: product.price?.purchase_price ?? 0,
          selling_price: product.price?.selling_price ?? 0,
          shell_price: product.price?.shell_price ?? 0,
          bottle_price: product.price?.bottle_price ?? 0,
          content_no: product.unit_type?.content_no || "",
          shell_type: product.unit_type?.shell_type || "",
          content_type: product.unit_type?.content_type || "",
          price_id: product.price?.id || null,
          unit_type_id: product.unit_type?.id || null,
          warehouse: product.warehouse || warehouseId,
          image: null,
          imagePreview: null,
          currentImage: product.image || null,
          removeImage: false
        };

        setFormData(productData);
        
        // ✅ NEW: Store original data for change detection
        setOriginalData({
          product_name: product.product_name || "",
          supplier_code: product.supplier_code || "",
          supplier: product.supplier || "",
          product_category: categoryId || "",
          returnable: product.unit_type?.returnable ?? true,
          purchase_price: product.price?.purchase_price ?? 0,
          selling_price: product.price?.selling_price ?? 0,
          shell_price: product.price?.shell_price ?? 0,
          bottle_price: product.price?.bottle_price ?? 0,
          content_no: product.unit_type?.content_no || "",
          shell_type: product.unit_type?.shell_type || "",
          content_type: product.unit_type?.content_type || "",
          currentImage: product.image || null,
          // Also store names for better change detection
          category_name: product.product_category?.name || "",
          supplier_name: "",
          shell_type_name: "",
          content_type_name: ""
        });

        // Fetch related names after setting dropdowns
        setTimeout(() => {
          const categoryName = categories.find(c => c.id === categoryId)?.name || "";
          const supplierName = suppliers.find(s => s.id === product.supplier)?.company_name || "";
          const shellTypeName = shellTypes.find(s => s.id === product.unit_type?.shell_type)?.description || "";
          const contentTypeName = contentTypes.find(c => c.id === product.unit_type?.content_type)?.description || "";
          
          setOriginalData(prev => ({
            ...prev,
            category_name: categoryName,
            supplier_name: supplierName,
            shell_type_name: shellTypeName,
            content_type_name: contentTypeName
          }));
        }, 100);

      } catch (err) {
        console.error("❌ Failed to load product:", err);
        setNotice({
          open: true,
          type: "error",
          text: "❌ Failed to load product data.",
        });
        setTimeout(() => navigate("/products"), 1500);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  // Update original data when dropdowns are loaded
  useEffect(() => {
    if (categories.length > 0 && shellTypes.length > 0 && contentTypes.length > 0 && suppliers.length > 0 && originalData.product_category) {
      const categoryName = categories.find(c => c.id.toString() === originalData.product_category.toString())?.name || "";
      const supplierName = suppliers.find(s => s.id.toString() === originalData.supplier.toString())?.company_name || "";
      const shellTypeName = shellTypes.find(s => s.id.toString() === originalData.shell_type.toString())?.description || "";
      const contentTypeName = contentTypes.find(c => c.id.toString() === originalData.content_type.toString())?.description || "";
      
      setOriginalData(prev => ({
        ...prev,
        category_name: categoryName,
        supplier_name: supplierName,
        shell_type_name: shellTypeName,
        content_type_name: contentTypeName
      }));
    }
  }, [categories, shellTypes, contentTypes, suppliers, originalData.product_category, originalData.supplier, originalData.shell_type, originalData.content_type]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;

    if (name === "returnable" && !checked) {
      setFormData((prev) => ({
        ...prev,
        returnable: false,
        shell_price: 0,
        bottle_price: 0,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: val }));
    }
  };

  // ✅ NEW: Function to detect and format changes
  const detectChanges = () => {
    const changes = {};
    
    // Check each field for changes
    if (originalData.product_name !== formData.product_name) {
      changes.name = { old: originalData.product_name, new: formData.product_name };
    }
    
    if (originalData.supplier_code !== formData.supplier_code) {
      changes.supplier_code = { old: originalData.supplier_code, new: formData.supplier_code };
    }
    
    if (originalData.product_category.toString() !== formData.product_category.toString()) {
      const newCategoryName = categories.find(c => c.id.toString() === formData.product_category.toString())?.name || 'Unknown';
      changes.category = { old: originalData.category_name, new: newCategoryName };
    }
    
    if (originalData.returnable !== formData.returnable) {
      changes.returnable = { old: originalData.returnable, new: formData.returnable };
    }
    
    if (Number(originalData.purchase_price) !== Number(formData.purchase_price)) {
      changes.purchase_price = { old: Number(originalData.purchase_price), new: Number(formData.purchase_price) };
    }
    
    if (Number(originalData.selling_price) !== Number(formData.selling_price)) {
      changes.price = { old: Number(originalData.selling_price), new: Number(formData.selling_price) };
    }
    
    if (Number(originalData.shell_price) !== Number(formData.shell_price)) {
      changes.shell_price = { old: Number(originalData.shell_price), new: Number(formData.shell_price) };
    }
    
    if (Number(originalData.bottle_price) !== Number(formData.bottle_price)) {
      changes.bottle_price = { old: Number(originalData.bottle_price), new: Number(formData.bottle_price) };
    }
    
    if (originalData.content_no !== formData.content_no) {
      changes.content_no = { old: originalData.content_no, new: formData.content_no };
    }
    
    if (originalData.shell_type.toString() !== formData.shell_type.toString()) {
      const newShellTypeName = shellTypes.find(s => s.id.toString() === formData.shell_type.toString())?.description || 'Unknown';
      changes.shell_type = { old: originalData.shell_type_name, new: newShellTypeName };
    }
    
    if (originalData.content_type.toString() !== formData.content_type.toString()) {
      const newContentTypeName = contentTypes.find(c => c.id.toString() === formData.content_type.toString())?.description || 'Unknown';
      changes.content_type = { old: originalData.content_type_name, new: newContentTypeName };
    }
    
    // Check image changes
    if (formData.removeImage && originalData.currentImage) {
      changes.image = { old: 'has image', new: 'removed' };
    } else if (formData.image && !originalData.currentImage) {
      changes.image = { old: 'none', new: 'added' };
    } else if (formData.image && originalData.currentImage) {
      changes.image = { old: 'has image', new: 'updated' };
    }
    
    return changes;
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    try {
      // 1) Pricing
      await axios.put(`http://localhost:8080/api/pricing/${formData.price_id}/`, {
        purchase_price: parseFloat(formData.purchase_price) || 0,
        selling_price: parseFloat(formData.selling_price) || 0,
        shell_price: parseFloat(formData.shell_price) || 0,
        bottle_price: parseFloat(formData.bottle_price) || 0,
      });

      // 2) Unit type
      await axios.put(`http://localhost:8080/api/unit-types/${formData.unit_type_id}/`, {
        content_no: formData.content_no,
        returnable: formData.returnable,
        shell_type: formData.shell_type,
        content_type: formData.content_type,
        content_returnable: formData.returnable,
      });

      // 3) Product with image handling
      const productFormData = new FormData();
      productFormData.append('system_code', formData.system_code);
      productFormData.append('supplier_code', formData.supplier_code);
      productFormData.append('supplier', formData.supplier);
      productFormData.append('product_name', formData.product_name);
      productFormData.append('product_category', formData.product_category);
      productFormData.append('unit_type', formData.unit_type_id);
      productFormData.append('price', formData.price_id);
      productFormData.append('warehouse', formData.warehouse);

      // Handle image logic
      if (formData.removeImage) {
        // Send empty string or special value to indicate image removal
        productFormData.append('remove_image', 'true');
      } else if (formData.image) {
        // Add new image if one was selected
        productFormData.append('image', formData.image);
      }

      await axios.put(`http://localhost:8080/api/products/${id}/`, productFormData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // ✅ NEW: Detect changes and trigger notification
      const changes = detectChanges();
      
      if (Object.keys(changes).length > 0) {
        console.log('📦 Product changes detected:', changes);
        
        // Get current user for updated_by field
        const userData = JSON.parse(localStorage.getItem("user") || "{}");
        
        // Trigger notification immediately
        notifyProductChange({
          action: 'updated',
          id: id,
          product_name: formData.product_name,
          product_code: formData.system_code,
          category: categories.find(c => c.id.toString() === formData.product_category.toString())?.name || 'Unknown',
          selling_price: formData.selling_price,
          changes: changes,
          updated_by: userData.username || userData.name || 'Admin'
        });
        
        console.log('📦 Product update notification sent!');
      } else {
        console.log('📦 No changes detected in product update');
      }

      setNotice({
        open: true,
        type: "success",
        text: "✅ Product updated successfully!",
      });

      setTimeout(() => {
        navigate("/products", { state: { refresh: true, timestamp: Date.now() }, replace: true });
      }, 1200);
    } catch (err) {
      console.error("❌ Update Error:", err.response?.data || err.message);
      setNotice({
        open: true,
        type: "error",
        text:
          "❌ Failed to update product: " +
          (err.response?.data?.message ||
            (typeof err.response?.data === "string" ? err.response.data : err.message)),
      });
    }
  };

  const handleSelectWithAddNew = (e, typeKey) => {
    if (e.target.value === "add_new") {
      setShowModal({ type: typeKey });
    } else {
      handleChange(e);
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
    } else if (showModal.type === "supplier") {
      endpoint = "suppliers/";
      payload = { company_name: newValue };
      fieldName = "supplier";
    }

    try {
      const res = await axios.post(`http://localhost:8080/api/${endpoint}`, payload);
      await fetchDropdowns();
      setFormData((prev) => ({ ...prev, [fieldName]: res.data.id }));
      setShowModal({ type: null });
      setNewValue("");
    } catch (err) {
      console.error("❌ Add New Error:", err.response?.data || err.message);
      setNotice({
        open: true,
        type: "error",
        text: "❌ Failed to add new item.",
      });
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="loading">
          <div className="spinner" aria-hidden="true"></div>
          <span className="loading-text">Loading product data…</span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleUpdate} className="page">
      <div className="page-header">
        <h2 className="page-title">Product Edit</h2>
        <div className="actions">
          <button type="button" className="btn btn-back" onClick={() => navigate("/products")}>
            Back
          </button>
          <button type="submit" className="btn btn-primary">
            Save Product
          </button>
        </div>
      </div>

      <div className="card pe-card">
        <table className="table table-hover">
          <thead>
            <tr>
              {[
                "System Code",
                "Supplier Code",
                "Supplier",
                "Product Name",
                "Product Category",
                "Image",
                "Returnable",
                "Purchase Price",
                "Selling Price",
                "Shell Price",
                "Bottle Price",
                "Content No",
                "Shell Type",
                "Content Type",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>
                <input
                  name="system_code"
                  value={formData.system_code}
                  readOnly
                  className="pe-input pe-input--readonly"
                />
              </td>

              <td>
                <input
                  name="supplier_code"
                  value={formData.supplier_code}
                  onChange={handleChange}
                  className="pe-input"
                />
              </td>

              <td>
                <select
                  name="supplier"
                  value={formData.supplier || ""}
                  onChange={(e) => handleSelectWithAddNew(e, "supplier")}
                  className="pe-select"
                >
                  <option value="">--Supplier--</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.company_name || s.name || `Supplier ${s.id}`}
                    </option>
                  ))}
                  <option value="add_new">+ Add New</option>
                </select>
              </td>

              <td>
                <input
                  name="product_name"
                  value={formData.product_name}
                  onChange={handleChange}
                  className="pe-input"
                />
              </td>

              <td>
                <select
                  name="product_category"
                  value={formData.product_category}
                  onChange={(e) => handleSelectWithAddNew(e, "category")}
                  className="pe-select"
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

              {/* Image Upload for Edit */}
              <td>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
                  {(formData.imagePreview || formData.currentImage) && !formData.removeImage ? (
                    <>
                      <img
                        src={formData.imagePreview || formData.currentImage}
                        alt="Product"
                        style={{ 
                          width: '80px', 
                          height: '80px', 
                          objectFit: 'cover', 
                          borderRadius: '6px',
                          border: '2px solid #e5e7eb'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
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
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
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
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        background: '#f3f4f6',
                        border: '2px dashed #d1d5db',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#9ca3af',
                        fontSize: '24px'
                      }}>
                        📷
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
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
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              </td>

              <td>
                <label className="pf-check-wrap">
                  <input
                    type="checkbox"
                    name="returnable"
                    checked={formData.returnable}
                    onChange={handleChange}
                    className="pf-checkbox"
                  />
                  <span className="pf-check-label">Yes</span>
                </label>
              </td>

              <td>
                <input
                  type="number"
                  name="purchase_price"
                  value={formData.purchase_price}
                  onChange={handleChange}
                  className="pe-input"
                />
              </td>

              <td>
                <input
                  type="number"
                  name="selling_price"
                  value={formData.selling_price}
                  onChange={handleChange}
                  className="pe-input"
                />
              </td>

              <td>
                <input
                  type="number"
                  name="shell_price"
                  value={formData.shell_price}
                  onChange={handleChange}
                  disabled={!formData.returnable}
                  className={`pe-input ${!formData.returnable ? "pe-input--disabled" : ""}`}
                />
              </td>

              <td>
                <input
                  type="number"
                  name="bottle_price"
                  value={formData.bottle_price}
                  onChange={handleChange}
                  disabled={!formData.returnable}
                  className={`pe-input ${!formData.returnable ? "pe-input--disabled" : ""}`}
                />
              </td>

              <td>
                <input
                  type="text"
                  name="content_no"
                  value={formData.content_no}
                  onChange={handleChange}
                  className="pe-input"
                />
              </td>

              <td>
                <select
                  name="shell_type"
                  value={formData.shell_type}
                  onChange={(e) => handleSelectWithAddNew(e, "shell")}
                  className="pe-select"
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

              <td>
                <select
                  name="content_type"
                  value={formData.content_type}
                  onChange={(e) => handleSelectWithAddNew(e, "content")}
                  className="pe-select"
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
          </tbody>
        </table>
      </div>

      {/* Add New modal */}
      {showModal.type && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-body">
              <h3 className="pe-modal-title">
                Add New {showModal.type.charAt(0).toUpperCase() + showModal.type.slice(1)}
              </h3>
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="pe-input w-full"
                placeholder="Enter value"
              />
              <div className="modal-actions">
                <button onClick={() => setShowModal({ type: null })} className="btn btn-back">
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

      {/* Notice modal */}
      {notice.open && (
        <div className="modal-overlay">
          <div className={`modal ${notice.type === "success" ? "modal--success" : "modal--error"}`}>
            <div className="modal-body">
              <p className="pe-modal-text text-center">{notice.text}</p>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

export default ProductEdit;
