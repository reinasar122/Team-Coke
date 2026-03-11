// ProductEdit.jsx - FIXED VERSION WITH WORKING NOTIFICATIONS
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { notifyProductChange } from "../utils/productNotifier";
import api from "../api";

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

  const [originalData, setOriginalData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
          removeImage: false
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (e) => {
    // Prevent event bubbling that might interfere with form
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    try {
      setFormData(prev => ({
        ...prev,
        image: null,
        imagePreview: null,
        removeImage: true
      }));
     
      // Clear file input safely
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Show brief confirmation
      setNotice({
        open: true,
        type: "success",
        text: "✅ Image marked for removal",
      });
     
      // Auto-hide notice after 2 seconds
      setTimeout(() => {
        setNotice(prev => ({ ...prev, open: false }));
      }, 2000);

    } catch (error) {
      console.error("Error in handleRemoveImage:", error);
    }
  };

  const fetchDropdowns = async () => {
    try {
      const [categoriesRes, shellTypesRes, contentTypesRes, suppliersRes] = await Promise.all([
        api.get("/product-categories/"),
        api.get("/shelltypes/"),
        api.get("/contenttypes/"),
        api.get("/suppliers/"),
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
        const res = await api.get(`/products/${id}/?warehouse_id=${warehouseId}`);
        const product = res.data;

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
          category_name: product.product_category?.name || "",
          supplier_name: "",
          shell_type_name: "",
          content_type_name: ""
        });

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

  const handleChange = (e) => {
    try {
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
    } catch (error) {
      console.error("Error in handleChange:", error);
    }
  };

  const detectChanges = () => {
    const changes = {};
   
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
   
    if (formData.removeImage && originalData.currentImage) {
      changes.image = { old: 'has image', new: 'removed' };
    } else if (formData.image && !originalData.currentImage) {
      changes.image = { old: 'none', new: 'added' };
    } else if (formData.image && originalData.currentImage) {
      changes.image = { old: 'has image', new: 'updated' };
    }
   
    return changes;
  };

  // ✅ FIXED: handleUpdate with working notifications
  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Validate required fields
      if (!formData.product_name?.trim()) {
        throw new Error("Product name is required");
      }

      // 1) Update pricing
      if (formData.price_id) {
        await api.put(`/pricing/${formData.price_id}/`, {
          purchase_price: parseFloat(formData.purchase_price) || 0,
          selling_price: parseFloat(formData.selling_price) || 0,
          shell_price: parseFloat(formData.shell_price) || 0,
          bottle_price: parseFloat(formData.bottle_price) || 0,
        });
      }

      // 2) Update unit type
      if (formData.unit_type_id) {
        await api.put(`/unit-types/${formData.unit_type_id}/`, {
          content_no: formData.content_no || '',
          returnable: Boolean(formData.returnable),
          shell_type: formData.shell_type || null,
          content_type: formData.content_type || null,
          content_returnable: Boolean(formData.returnable),
        });
      }

      // 3) Update product with proper image handling
      const updateData = new FormData();
     
      updateData.append('system_code', formData.system_code || '');
      updateData.append('supplier_code', formData.supplier_code || '');
      updateData.append('supplier', formData.supplier || '');
      updateData.append('product_name', formData.product_name || '');
      updateData.append('product_category', formData.product_category || '');
      updateData.append('unit_type', formData.unit_type_id || '');
      updateData.append('price', formData.price_id || '');
      updateData.append('warehouse', formData.warehouse || '');

      // Handle image removal/upload
      if (formData.removeImage) {
        updateData.append('remove_image', 'true');
        console.log('🗑️ Sending remove_image=true to backend');
      } else if (formData.image) {
        updateData.append('image', formData.image);
        console.log('📷 Uploading new image file');
      }

      const config = {
        headers: {},
        timeout: 30000,
      };

      await api.patch(`/products/${id}/`, updateData, config);

      // ✅ FIXED: Detect changes and send notification WITH warehouse info
      const changes = detectChanges();
     
      if (Object.keys(changes).length > 0) {
        const userData = JSON.parse(localStorage.getItem("user") || "{}");
       
        // ✅ CRITICAL FIX: Include warehouse information for notification filtering
        notifyProductChange({
          action: 'updated',
          id: id,
          product_name: formData.product_name,
          product_code: formData.system_code,
          category: categories.find(c => c.id.toString() === formData.product_category.toString())?.name || 'Unknown',
          selling_price: formData.selling_price,
          changes: changes,
          updated_by: userData.username || userData.name || 'Admin',
          // ✅ MISSING FIELDS THAT CAUSED NOTIFICATION TO NOT SHOW:
          warehouse_id: formData.warehouse,
          warehouseId: formData.warehouse,
          targetWarehouse: formData.warehouse,
          restrictToWarehouse: true,
          metadata: {
            supplier_code: formData.supplier_code,
            purchase_price: formData.purchase_price,
            returnable: formData.returnable,
            created_at: new Date().toISOString(),
            event_timestamp: Date.now()
          }
        });
       
        console.log('📦 Product update notification sent for warehouse:', formData.warehouse);
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
      console.error("❌ Update Error:", err);
     
      let errorMessage = "❌ Failed to update product";
     
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          const html500 =
           err.response.data.trim().startsWith("<!DOCTYPE") ||
           err.response.data.trim().startsWith('<html');
          errorMessage += html500 
            ? ": Server error while uploading image. Please checks backend logs"
            : `: ${err.response.data}`;
        } else if (err.response.data.message) {
          errorMessage += `: ${err.response.data.message}`;
        } else if (err.response.data.detail) {
          errorMessage += `: ${err.response.data.detail}`;
        }
      } else if (err.message) {
        errorMessage += `: ${err.message}`;
      }
     
      setNotice({
        open: true,
        type: "error",
        text: errorMessage,
      });
    } finally {
      setSaving(false);
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
      const res = await api.post(`/${endpoint}`, payload);
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
        <div className="actions" style={{ gap: '5px', display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-back"
            onClick={() => navigate("/products")}
            disabled={saving}
          >
            Back
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="card pe-card">
        <table className="table table-hover">
          <thead>
            <tr>
              {[
                "Supplier",
                "Supplier Product Code",
                "System Product Code",
                "Product Name",
                "Product Category",
                "Return Required",
                "Purchase Price (Pcs.)",
                "Shell Price",
                "Empty Bottle/s Price",
                "Shell Type",
                "Quantity (Pcs.)",
                "Content Type",
                "Selling Price",
                "Image",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>
                <select
                  name="supplier"
                  value={formData.supplier || ""}
                  onChange={(e) => handleSelectWithAddNew(e, "supplier")}
                  className="pe-select"
                  disabled={saving}
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
                  name="supplier_code"
                  value={formData.supplier_code}
                  onChange={handleChange}
                  className="pe-input"
                  disabled={saving}
                />
              </td>

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
                  name="product_name"
                  value={formData.product_name}
                  onChange={handleChange}
                  className="pe-input"
                  disabled={saving}
                  required
                />
              </td>

              <td>
                <select
                  name="product_category"
                  value={formData.product_category}
                  onChange={(e) => handleSelectWithAddNew(e, "category")}
                  className="pe-select"
                  disabled={saving}
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

              <td>
                <label className="pf-check-wrap">
                  <input
                    type="checkbox"
                    name="returnable"
                    checked={formData.returnable}
                    onChange={handleChange}
                    className="pf-checkbox"
                    disabled={saving}
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
                  disabled={saving}
                />
              </td>

              <td>
                <input
                  type="number"
                  name="shell_price"
                  value={formData.shell_price}
                  onChange={handleChange}
                  disabled={!formData.returnable || saving}
                  className={`pe-input ${!formData.returnable ? "pe-input--disabled" : ""}`}
                />
              </td>

              <td>
                <input
                  type="number"
                  name="bottle_price"
                  value={formData.bottle_price}
                  onChange={handleChange}
                  disabled={!formData.returnable || saving}
                  className={`pe-input ${!formData.returnable ? "pe-input--disabled" : ""}`}
                />
              </td>

              <td>
                <select
                  name="shell_type"
                  value={formData.shell_type}
                  onChange={(e) => handleSelectWithAddNew(e, "shell")}
                  className="pe-select"
                  disabled={saving}
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
                <input
                  type="text"
                  name="content_no"
                  value={formData.content_no}
                  onChange={handleChange}
                  className="pe-input"
                  disabled={saving}
                />
              </td>

              <td>
                <select
                  name="content_type"
                  value={formData.content_type}
                  onChange={(e) => handleSelectWithAddNew(e, "content")}
                  className="pe-select"
                  disabled={saving}
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

              <td>
                <input
                  type="number"
                  name="selling_price"
                  value={formData.selling_price}
                  onChange={handleChange}
                  className="pe-input"
                  disabled={saving}
                />
              </td>

              {/* Fixed Image display logic that won't break UI */}
              <td>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
                  {formData.removeImage ? (
                    // Show removal state
                    <>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        background: '#fee2e2',
                        border: '2px dashed #dc2626',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#dc2626',
                        fontSize: '12px',
                        textAlign: 'center',
                        padding: '4px'
                      }}>
                       📷
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setFormData(prev => ({ ...prev, removeImage: false }));
                        }}
                        disabled={saving}
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          background: '#f3f4f6',
                          color: '#374151',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          cursor: saving ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Undo Remove
                      </button>
                    </>
                  ) : (formData.imagePreview || formData.currentImage) ? (
                    // Show existing or new image
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
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                          disabled={saving}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            background: '#f3f4f6',
                            color: '#374151',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            cursor: saving ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          disabled={saving}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            background: '#fef2f2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: '4px',
                            cursor: saving ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </>
                  ) : (
                    // Show upload state
                    <>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        background: '#f3f4f6',
                        border: '2px solid #e5e7eb',
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
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        disabled={saving}
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          background: '#f3f4f6',
                          color: '#374151',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          cursor: saving ? 'not-allowed' : 'pointer'
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
                    disabled={saving}
                  />
                </div>
              </td>  
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ height: '32px' }}></div>

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

     {/* Centered notification overlay */}
{notice.open && (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backgroundColor: notice.type === "error" ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.1)',
    pointerEvents: notice.type === "error" ? 'auto' : 'none'
  }}>
    <div style={{
      background: notice.type === "error" ? '#fef2f2' : '#f0fdf4',
      color: notice.type === "error" ? '#991b1b' : '#065f46',
      padding: '20px 24px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      borderLeft: `4px solid ${notice.type === "error" ? '#ef4444' : '#10b981'}`,
      minWidth: '320px',
      maxWidth: '500px',
      textAlign: 'center',
      pointerEvents: 'auto',
      transform: 'translateY(0)',
      animation: 'slideIn 0.3s ease-out'
    }}>
      <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: '1.5' }}>
        {notice.text}
      </p>
      {notice.type === "error" && (
        <button
          onClick={() => setNotice(prev => ({ ...prev, open: false }))}
          className="btn btn-back"
          style={{ fontSize: '14px', padding: '8px 16px' }}
        >
          Close
        </button>
      )}
    </div>
  </div>
)}
    </form>
  );
};

export default ProductEdit;