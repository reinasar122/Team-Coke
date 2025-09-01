import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { canCreate, canEdit, canDelete } from '../utils/accessControl';

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Get current warehouse from user session
  const getCurrentWarehouse = () => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    if ((userData.role || '').toLowerCase() === "admin") {
      return selectedWarehouse?.id || userData.warehouse_id;
    }
    return userData.warehouse_id;
  };

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const warehouseId = getCurrentWarehouse();

      if (!warehouseId) {
        console.warn("No warehouse assigned to user");
        setProducts([]);
        return;
      }

      const res = await axios.get(`http://localhost:8080/api/products/?warehouse_id=${warehouseId}`);
      setProducts(res.data);
    } catch (err) {
      console.error("Error fetching products:", err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    const handleWarehouseChange = () => fetchProducts();
    window.addEventListener('warehouseChanged', handleWarehouseChange);
    return () => window.removeEventListener('warehouseChanged', handleWarehouseChange);
  }, [fetchProducts]);

  const handleDelete = async (id) => {
    const showConfirmDialog = (message, onConfirm) => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      `;
      modal.innerHTML = `
        <div class="modal" style="
          background: white;
          padding: 24px;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
          max-width: 400px;
          width: 90%;
        ">
          <div class="modal-body">
            <p class="text-muted" style="margin-bottom: 20px; color: #64748b;">${message}</p>
            <div class="modal-actions" style="display: flex; gap: 12px; justify-content: flex-end;">
              <button class="btn btn-back h-6 js-cancel" style="
                padding: 8px 16px;
                border: 1px solid #e2e8f0;
                background: #f1f5f9;
                color: #64748b;
                border-radius: 6px;
                cursor: pointer;
              ">Cancel</button>
              <button class="btn btn-danger h-6 js-confirm" style="
                padding: 8px 16px;
                border: none;
                background: #dc2626;
                color: white;
                border-radius: 6px;
                cursor: pointer;
              ">Delete</button>
            </div>
          </div>
        </div>
      `;
      modal.querySelector('.js-cancel').onclick = () => modal.remove();
      modal.querySelector('.js-confirm').onclick = () => {
        modal.remove();
        onConfirm();
      };
      document.body.appendChild(modal);
    };

    const showAlert = (message, variant = 'primary') => {
      const alert = document.createElement('div');
      alert.className = 'modal-overlay';
      alert.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      `;
      alert.innerHTML = `
        <div class="modal" style="
          background: white;
          padding: 24px;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
          max-width: 400px;
          width: 90%;
        ">
          <div class="modal-body">
            <p class="text-muted" style="margin-bottom: 20px; color: #64748b;">${message}</p>
            <div class="modal-actions" style="display: flex; justify-content: flex-end;">
              <button class="btn js-ok" style="
                padding: 8px 16px;
                border: none;
                background: ${variant === 'danger' ? '#dc2626' : '#5D5CDE'};
                color: white;
                border-radius: 6px;
                cursor: pointer;
              ">OK</button>
            </div>
          </div>
        </div>
      `;
      alert.querySelector('.js-ok').onclick = () => alert.remove();
      document.body.appendChild(alert);
    };

    showConfirmDialog("Are you sure you want to delete this product?", async () => {
      try {
        const warehouseId = getCurrentWarehouse();
        await axios.delete(`http://localhost:8080/api/products/${id}/?warehouse_id=${warehouseId}`);
        setProducts(prev => prev.filter(prod => prod.id !== id));
        showAlert("🗑️ Product deleted successfully!");
      } catch (err) {
        console.error("Delete error:", err);
        showAlert("❌ Failed to delete product. " + (err.response?.data?.message || err.message), 'danger');
      }
    });
  };

  if (loading) {
    return (
      <div className="page">
        <div className="loading">
          <div className="spinner" aria-hidden="true"></div>
          <span className="loading-text">Loading products…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header" style={{ flexWrap: 'wrap', rowGap: 8 }}>
        <h2 className="page-title" style={{ marginRight: 'auto' }}>Product List</h2>
        <Link
          to="/products/new"
          className={`btn ${canCreate("Product") ? 'btn-add' : 'btn-disabled'}`}
          onClick={(e) => { if (!canCreate("Product")) e.preventDefault(); }}
        >
          + Add Product
        </Link>
      </div>

      {/* Empty state */}
      {products.length === 0 ? (
        <div className="empty-state">
          <p className="text-muted">No products found in your warehouse.</p>
        </div>
      ) : (
        /* Card grid layout - bigger cards with increased spacing */
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: 24 
        }}>
          {products.map(prod => (
            <div key={prod.id} className="card" style={{ padding: 28 }}>
              {/* Card Layout: Image Left (full), Details Right */}
              <div style={{ 
                display: 'flex', 
                gap: 24,
                alignItems: 'flex-start'
              }}>
                {/* Image on LEFT - larger size */}
                {prod.image ? (
                  <img
                    src={prod.image}
                    alt={prod.product_name}
                    style={{
                      width: '180px',
                      height: '180px',
                      objectFit: 'cover',
                      borderRadius: '10px',
                      border: '2px solid #e5e7eb',
                      flexShrink: 0
                    }}
                  />
                ) : (
                  <div style={{
                    width: '180px',
                    height: '180px',
                    background: '#f3f4f6',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9ca3af',
                    fontSize: '36px',
                    flexShrink: 0
                  }}>
                    📷
                  </div>
                )}

                {/* Details on RIGHT - Full text visible with larger fonts */}
                <div style={{ flex: 1, display: 'grid', gap: 16 }}>
                  {/* Product Name - larger font */}
                  <h3 style={{ 
                    fontSize: '20px',
                    fontWeight: '600',
                    margin: 0,
                    color: '#1e293b',
                    wordWrap: 'break-word',
                    lineHeight: '1.3'
                  }}>
                    {prod.product_name}
                  </h3>

                  {/* Product Details - slightly larger text with more spacing */}
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ padding: '3px 0' }}>
                      <span className="text-muted" style={{ fontWeight: '500', fontSize: '15px' }}>System Code: </span>
                      <span style={{ fontWeight: '500', fontSize: '15px', color: '#1e293b', wordWrap: 'break-word' }}>
                        {prod.system_code}
                      </span>
                    </div>
                    <div style={{ padding: '3px 0' }}>
                      <span className="text-muted" style={{ fontWeight: '500', fontSize: '15px' }}>Supplier Code: </span>
                      <span style={{ fontWeight: '500', fontSize: '15px', color: '#1e293b', wordWrap: 'break-word' }}>
                        {prod.supplier_code}
                      </span>
                    </div>
                    <div style={{ padding: '3px 0' }}>
                      <span className="text-muted" style={{ fontWeight: '500', fontSize: '15px' }}>Category: </span>
                      <span style={{ fontWeight: '500', fontSize: '15px', color: '#1e293b', wordWrap: 'break-word' }}>
                        {prod.product_category?.name || "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Actions below details - moved to right side */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'flex-end',
                    gap: 10,
                    marginTop: 12
                  }}>
                    {canEdit("Product") ? (
                      <Link to={`/products/${prod.id}/edit`} title="Edit" className="icon-btn icon-btn-edit" style={{ padding: '10px', fontSize: '16px' }}>
                        <FaEdit aria-hidden="true" />
                        <span className="sr-only">Edit</span>
                      </Link>
                    ) : (
                      <span title="No access" className="icon-btn icon-btn-disabled" style={{ padding: '10px', fontSize: '16px' }}>
                        <FaEdit aria-hidden="true" />
                        <span className="sr-only">No edit access</span>
                      </span>
                    )}
                    {canDelete("Product") ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(prod.id)}
                        title="Delete"
                        className="icon-btn icon-btn-danger"
                        style={{ padding: '10px', fontSize: '16px' }}
                      >
                        <FaTrash aria-hidden="true" />
                        <span className="sr-only">Delete</span>
                      </button>
                    ) : (
                      <span title="No access" className="icon-btn icon-btn-disabled" style={{ padding: '10px', fontSize: '16px' }}>
                        <FaTrash aria-hidden="true" />
                        <span className="sr-only">No delete access</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductList;