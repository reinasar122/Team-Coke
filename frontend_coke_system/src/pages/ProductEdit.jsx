import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { getProductImage } from '../utils/productImages';

import "../styles/pages/productedit.scss";

const ProductEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();

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
    current_image_url: null,
  });

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [shellTypes, setShellTypes] = useState([]);
  const [contentTypes, setContentTypes] = useState([]);
  const [showModal, setShowModal] = useState({ type: null });
  const [newValue, setNewValue] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [imagePreview, setImagePreview] = useState(null);

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

        setFormData({
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
          current_image_url: product.image_url || null,
        });

        // Set image preview - either uploaded image or auto-generated
        if (product.image_url) {
          setImagePreview(`http://localhost:8080${product.image_url}`);
        } else {
          setImagePreview(getProductImage(product));
        }
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

  // Update auto-generated image when product name or category changes
  useEffect(() => {
    if (formData.product_name && !formData.current_image_url && !formData.image) {
      const category = categories.find(cat => cat.id === formData.product_category);
      const productForImage = {
        product_name: formData.product_name,
        product_category: category,
        price: {
          selling_price: formData.selling_price,
          purchase_price: formData.purchase_price
        }
      };
      setImagePreview(getProductImage(productForImage));
    }
  }, [formData.product_name, formData.product_category, categories, formData.current_image_url, formData.image]);

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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setNotice({
          open: true,
          type: "error",
          text: "Please select a valid image file.",
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setNotice({
          open: true,
          type: "error",
          text: "Image size must be less than 5MB.",
        });
        return;
      }

      setFormData(prev => ({ ...prev, image: file }));

      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Fixed remove custom image function
  const removeCustomImage = () => {
    console.log("Removing custom image...");
    
    // Clear the new image from form data
    setFormData(prev => ({ ...prev, image: null }));
    
    // Show auto-generated image instead
    const category = categories.find(cat => cat.id === formData.product_category);
    const productForImage = {
      product_name: formData.product_name,
      product_category: category,
      price: {
        selling_price: formData.selling_price,
        purchase_price: formData.purchase_price
      }
    };
    setImagePreview(getProductImage(productForImage));
    
    // Clear the file input
    const fileInput = document.getElementById('image-input');
    if (fileInput) {
      fileInput.value = '';
    }
    
    setNotice({
      open: true,
      type: "success",
      text: "✅ New image removed! Auto-generated image restored.",
    });

    // Auto-hide notice after 2 seconds
    setTimeout(() => {
      setNotice(prev => ({ ...prev, open: false }));
    }, 2000);
  };

  // Fixed delete current image function
  const deleteCurrentImage = async () => {
    console.log("Deleting current image...");
    
    try {
      // Try different approaches to delete the image
      const formDataForDelete = new FormData();
      
      // Add all the required fields
      formDataForDelete.append('system_code', formData.system_code);
      formDataForDelete.append('supplier_code', formData.supplier_code);
      formDataForDelete.append('supplier', formData.supplier);
      formDataForDelete.append('product_name', formData.product_name);
      formDataForDelete.append('product_category', formData.product_category);
      formDataForDelete.append('unit_type', formData.unit_type_id);
      formDataForDelete.append('price', formData.price_id);
      formDataForDelete.append('warehouse', formData.warehouse);
      
      // Send empty file to remove image
      formDataForDelete.append('image', new Blob(), '');

      const response = await axios.put(`http://localhost:8080/api/products/${id}/`, formDataForDelete, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log("Delete image response:", response);

      // Update local state
      setFormData(prev => ({ ...prev, current_image_url: null }));
      
      // Show auto-generated image instead
      const category = categories.find(cat => cat.id === formData.product_category);
      const productForImage = {
        product_name: formData.product_name,
        product_category: category,
        price: {
          selling_price: formData.selling_price,
          purchase_price: formData.purchase_price
        }
      };
      setImagePreview(getProductImage(productForImage));
      
      setNotice({
        open: true,
        type: "success",
        text: "✅ Custom image deleted! Auto-generated image restored.",
      });

      // Auto-hide notice after 2 seconds
      setTimeout(() => {
        setNotice(prev => ({ ...prev, open: false }));
      }, 2000);
      
    } catch (err) {
      console.error("❌ Remove Image Error:", err);
      console.error("Error details:", err.response?.data);
      
      setNotice({
        open: true,
        type: "error",
        text: "❌ Failed to remove image: " + (err.response?.data?.message || err.message),
      });

      // Auto-hide error notice after 3 seconds
      setTimeout(() => {
        setNotice(prev => ({ ...prev, open: false }));
      }, 3000);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    try {
      await axios.put(`http://localhost:8080/api/pricing/${formData.price_id}/`, {
        purchase_price: parseFloat(formData.purchase_price) || 0,
        selling_price: parseFloat(formData.selling_price) || 0,
        shell_price: parseFloat(formData.shell_price) || 0,
        bottle_price: parseFloat(formData.bottle_price) || 0,
      });

      await axios.put(`http://localhost:8080/api/unit-types/${formData.unit_type_id}/`, {
        content_no: formData.content_no,
        returnable: formData.returnable,
        shell_type: formData.shell_type,
        content_type: formData.content_type,
        content_returnable: formData.returnable,
      });

      const hasNewImage = formData.image !== null;
      
      if (hasNewImage) {
        const updateFormData = new FormData();
        updateFormData.append('system_code', formData.system_code);
        updateFormData.append('supplier_code', formData.supplier_code);
        updateFormData.append('supplier', formData.supplier);
        updateFormData.append('product_name', formData.product_name);
        updateFormData.append('product_category', formData.product_category);
        updateFormData.append('unit_type', formData.unit_type_id);
        updateFormData.append('price', formData.price_id);
        updateFormData.append('warehouse', formData.warehouse);
        updateFormData.append('image', formData.image);

        await axios.put(`http://localhost:8080/api/products/${id}/`, updateFormData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      } else {
        const productUpdatePayload = {
          system_code: formData.system_code,
          supplier_code: formData.supplier_code,
          supplier: formData.supplier,
          product_name: formData.product_name,
          product_category: formData.product_category,
          unit_type: formData.unit_type_id,
          price: formData.price_id,
          warehouse: formData.warehouse,
        };

        await axios.put(`http://localhost:8080/api/products/${id}/`, productUpdatePayload);
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

      {/* Image Section */}
      <div className="card pe-card" style={{ marginBottom: '1rem' }}>
        <div style={{ padding: '1rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: '600' }}>Product Image</h3>
          
          <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <img 
                src={imagePreview} 
                alt="Product" 
                style={{ 
                  width: '120px', 
                  height: '120px', 
                  objectFit: 'cover', 
                  borderRadius: '8px', 
                  border: '2px solid #e5e7eb' 
                }}
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/120x120/6366F1/FFFFFF?text=P';
                }}
              />
              {(formData.image || formData.current_image_url) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("X button clicked", { hasNewImage: !!formData.image, hasCurrentImage: !!formData.current_image_url });
                    if (formData.image) {
                      removeCustomImage();
                    } else {
                      deleteCurrentImage();
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                  title={formData.image ? "Remove new image" : "Delete uploaded image"}
                >
                  ×
                </button>
              )}
            </div>
            
            <div style={{ flex: 1, minWidth: '200px' }}>
              <input
                type="file"
                id="image-input"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
              
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => document.getElementById('image-input').click()}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                  {formData.current_image_url ? 'Change Image' : 'Upload Custom Image'}
                </button>
              </div>
              
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0' }}>
                {formData.current_image_url ? 'Custom image uploaded' : 'Auto-generated image (upload custom to override)'}
              </p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0.25rem 0 0 0' }}>
                Supports: JPG, PNG, GIF (max 5MB)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Your existing form table */}
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