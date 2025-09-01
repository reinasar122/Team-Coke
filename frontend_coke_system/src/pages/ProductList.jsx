// import { getProductImage } from '../utils/productImages';
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { canCreate, canEdit, canDelete } from '../utils/accessControl';
import "../styles/pages/productlist.scss";

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

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
    // Add these styles to the document if they don't exist
    if (!document.getElementById('modal-styles')) {
      const style = document.createElement('style');
      style.id = 'modal-styles';
      style.textContent = `
        .modal-overlay {
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
        }
        .modal {
          background: white;
          border-radius: 8px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        }
        .modal-body {
          text-align: center;
        }
        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-top: 20px;
        }
        .dark .modal {
          background: #1f2937;
          color: white;
        }
      `;
      document.head.appendChild(style);
    }

    const showConfirmDialog = (message, onConfirm) => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal">
          <div class="modal-body">
            <p class="text-muted">${message}</p>
            <div class="pf-actions">
              <button class="btn btn-back h-6 js-cancel">Cancel</button>
              <button class="btn btn-danger h-6 js-confirm">Delete</button>
            </div>
          </div>
        </div>
      `;
      
      const cancelBtn = modal.querySelector('.js-cancel');
      const confirmBtn = modal.querySelector('.js-confirm');
      
      cancelBtn.onclick = (e) => {
        e.preventDefault();
        modal.remove();
      };
      
      confirmBtn.onclick = (e) => {
        e.preventDefault();
        modal.remove();
        onConfirm();
      };
      
      document.body.appendChild(modal);
      cancelBtn.focus();
    };

    const showAlert = (message, variant = 'primary') => {
      const alert = document.createElement('div');
      alert.className = 'modal-overlay';
      alert.innerHTML = `
        <div class="modal">
          <div class="modal-body">
            <p class="text-muted">${message}</p>
            <div class="pf-actions">
              <button class="btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'} js-ok">OK</button>
            </div>
          </div>
        </div>
      `;
      
      const okBtn = alert.querySelector('.js-ok');
      okBtn.onclick = (e) => {
        e.preventDefault();
        alert.remove();
      };
      
      document.body.appendChild(alert);
      okBtn.focus();
    };

    // Check if user has delete permission
    if (!canDelete("Product")) {
      showAlert("❌ You don't have permission to delete products.", 'danger');
      return;
    }

    showConfirmDialog("Are you sure you want to delete this product?", async () => {
      try {
        console.log('Attempting to delete product with ID:', id);
        const warehouseId = getCurrentWarehouse();
        console.log('Warehouse ID:', warehouseId);
        
        let deleteUrl = `http://localhost:8080/api/products/${id}/`;
        if (warehouseId) {
          deleteUrl += `?warehouse_id=${warehouseId}`;
        }
        
        console.log('Delete URL:', deleteUrl);
        
        const response = await axios.delete(deleteUrl);
        console.log('Delete response:', response);
        
        setProducts(prev => {
          const updated = prev.filter(prod => prod.id !== id);
          console.log('Products after delete:', updated.length);
          return updated;
        });
        
        showAlert("🗑️ Product deleted successfully!");
      } catch (err) {
        console.error('Delete error:', err);
        console.error('Error response:', err.response?.data);
        console.error('Error status:', err.response?.status);
        
        let errorMessage = "❌ Failed to delete product.";
        if (err.response?.status === 403) {
          errorMessage = "❌ Access denied. You don't have permission to delete this product.";
        } else if (err.response?.status === 404) {
          errorMessage = "❌ Product not found.";
        } else if (err.response?.data?.message) {
          errorMessage = `❌ ${err.response.data.message}`;
        }
        
        showAlert(errorMessage, 'danger');
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

      {products.length === 0 ? (
        <div className="empty-state">
          <p className="text-muted">No products found in your warehouse.</p>
        </div>
      ) : (
        <div 
          className="product-grid" 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
            marginTop: '20px'
          }}
        >
          {products.map(prod => (
            <div 
              key={prod.id} 
              className="card product-card" 
              style={{
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
              }}
            >
              {/* Action buttons - top right */}
              <div 
                className="actions" 
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  display: 'flex',
                  gap: '8px'
                }}
              >
                {canEdit("Product") ? (
                  <Link 
                    to={`/products/${prod.id}/edit`} 
                    title="Edit" 
                    className="icon-btn icon-btn-edit"
                    style={{
                      background: 'rgba(99, 102, 241, 0.1)',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                      borderRadius: '6px',
                      padding: '8px'
                    }}
                  >
                    <FaEdit aria-hidden="true" />
                    <span className="sr-only">Edit</span>
                  </Link>
                ) : (
                  <span title="No access" className="icon-btn icon-btn-disabled">
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
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '6px',
                      padding: '8px'
                    }}
                  >
                    <FaTrash aria-hidden="true" />
                    <span className="sr-only">Delete</span>
                  </button>
                ) : (
                  <span title="No access" className="icon-btn icon-btn-disabled">
                    <FaTrash aria-hidden="true" />
                    <span className="sr-only">No delete access</span>
                  </span>
                )}
              </div>

              {/* Product Image - Large and prominent */}
              <div 
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}
              >
                <img 
                  src={'https://via.placeholder.com/120x120/6366F1/FFFFFF?text=P'}
                  alt={prod.product_name}
                  style={{
                    width: '120px',
                    height: '120px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/120x120/6366F1/FFFFFF?text=P';
                  }}
                />
              </div>

              {/* Product Name - Main title */}
              <div style={{ marginBottom: '12px', textAlign: 'center' }}>
                <h3 
                  style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    margin: '0',
                    color: '#1f2937',
                    lineHeight: '1.4'
                  }}
                  className="product-name"
                >
                  {prod.product_name}
                </h3>
              </div>

              {/* Product Details */}
              <div style={{ display: 'grid', gap: '8px' }}>
                <div 
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: '#f9fafb',
                    borderRadius: '6px'
                  }}
                >
                  <span 
                    className="text-muted" 
                    style={{ 
                      fontSize: '14px',
                      fontWeight: '500' 
                    }}
                  >
                    System Code
                  </span>
                  <span 
                    style={{ 
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151'
                    }}
                  >
                    {prod.system_code}
                  </span>
                </div>

                <div 
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: '#f9fafb',
                    borderRadius: '6px'
                  }}
                >
                  <span 
                    className="text-muted" 
                    style={{ 
                      fontSize: '14px',
                      fontWeight: '500' 
                    }}
                  >
                    Supplier Code
                  </span>
                  <span 
                    style={{ 
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151'
                    }}
                  >
                    {prod.supplier_code}
                  </span>
                </div>

                <div 
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: '#f9fafb',
                    borderRadius: '6px'
                  }}
                >
                  <span 
                    className="text-muted" 
                    style={{ 
                      fontSize: '14px',
                      fontWeight: '500' 
                    }}
                  >
                    Category
                  </span>
                  <span 
                    style={{ 
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#5d5cde',
                      background: 'rgba(93, 92, 222, 0.1)',
                      padding: '4px 8px',
                      borderRadius: '4px'
                    }}
                  >
                    {prod.product_category?.name || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add some responsive styles */}
      <style jsx>{`
        @media (max-width: 768px) {
          .product-grid {
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)) !important;
            gap: 16px !important;
          }
          .product-card {
            padding: 16px !important;
          }
        }
        
        @media (max-width: 480px) {
          .product-grid {
            grid-template-columns: 1fr !important;
          }
        }

        .dark .product-name {
          color: #f9fafb !important;
        }

        .dark .product-card div[style*="background: #f9fafb"] {
          background: #374151 !important;
        }
      `}</style>
    </div>
  );
};

export default ProductList;