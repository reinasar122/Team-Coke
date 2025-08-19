import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { canCreate, canEdit, canDelete } from '../utils/accessControl';

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false
  );

  // Track viewport size for responsive render
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = (e) => setIsNarrow(e.matches);
    mq.addEventListener?.('change', onChange);
    // Safari fallback
    mq.addListener?.(onChange);
    return () => {
      mq.removeEventListener?.('change', onChange);
      mq.removeListener?.(onChange);
    };
  }, []);

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
      modal.innerHTML = `
        <div class="modal">
          <div class="modal-body">
            <p class="text-muted">${message}</p>
            <div class="modal-actions">
              <button class="btn btn-back h-6 js-cancel">Cancel</button>
              <button class="btn btn-danger h-6 js-confirm">Delete</button>
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
      alert.innerHTML = `
        <div class="modal">
          <div class="modal-body">
            <p class="text-muted">${message}</p>
            <div class="modal-actions">
              <button class="btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'} js-ok">OK</button>
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
        console.error(err);
        showAlert("❌ Failed to delete product.", 'danger');
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
        <>
          {/* Desktop / Tablet: Table (>= 769px) */}
          {!isNarrow && (
            <div className="card">
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <table className="table table-hover" style={{ minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th>System Code</th>
                      <th>Supplier Code</th>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th className="w-128">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(prod => (
                      <tr key={prod.id}>
                        <td>{prod.system_code}</td>
                        <td>{prod.supplier_code}</td>
                        <td>{prod.product_name}</td>
                        <td>{prod.product_category?.name || "N/A"}</td>
                        <td>
                          <div className="actions">
                            {canEdit("Product") ? (
                              <Link to={`/products/${prod.id}/edit`} title="Edit" className="icon-btn icon-btn-edit">
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mobile: Card list (<= 768px) */}
          {isNarrow && (
            <div style={{ display: 'grid', gap: 12 }}>
              {products.map(prod => (
                <div key={prod.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <strong>{prod.product_name}</strong>
                      <div className="actions">
                        {canEdit("Product") ? (
                          <Link to={`/products/${prod.id}/edit`} title="Edit" className="icon-btn icon-btn-edit">
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
                    </div>

                    <div style={{ display: 'grid', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <span className="text-muted">System Code</span>
                        <span>{prod.system_code}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <span className="text-muted">Supplier Code</span>
                        <span>{prod.supplier_code}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <span className="text-muted">Category</span>
                        <span>{prod.product_category?.name || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProductList;
