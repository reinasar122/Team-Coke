// ProductList.jsx - COMPLETE UPDATED VERSION WITH DELETE NOTIFICATIONS
import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { FaEdit, FaTrash, FaChevronLeft, FaChevronRight, FaChevronDown } from 'react-icons/fa';
import { canCreate, canEdit, canDelete } from '../utils/accessControl';
import { notifyProductChange } from '../utils/productNotifier'; // ✅ NEW IMPORT
import api from "../api"; // ✅ correct

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [showPagination, setShowPagination] = useState(false);
  const [productsPerPage, setProductsPerPage] = useState(6); // Dynamic value
  const [viewMode, setViewMode] = useState('carousel'); // 'carousel' or 'table'
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const gridRef = useRef(null);

  // ✅ NEW: Trigger products page visit event for notifications
  useEffect(() => {
    // Notify that products page was visited (for notification system)
    const event = new CustomEvent('productsPageVisited');
    window.dispatchEvent(event);
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

  // Calculate products per page based on zoom level (only for carousel mode)
  const calculateProductsPerPage = useCallback(() => {
    // Get zoom level - different methods for different browsers
    let zoomLevel = 1;
    
    // Method 1: Compare outer and inner width (most reliable for zoom detection)
    if (window.outerWidth && window.innerWidth) {
      zoomLevel = window.outerWidth / window.innerWidth;
    }
    
    // Method 2: Use devicePixelRatio as fallback
    if (zoomLevel === 1 && window.devicePixelRatio) {
      zoomLevel = 1 / window.devicePixelRatio;
    }
    
    // Convert to percentage
    const zoomPercentage = Math.round(zoomLevel * 100);
    
    // Direct mapping based on zoom levels
    let productsCount = 6; // default for 100%
    
    if (zoomPercentage >= 125) {
      productsCount = 4; // Zoomed in - fewer products fit
    } else if (zoomPercentage >= 100) {
      productsCount = 6; // Normal zoom
    } else if (zoomPercentage >= 90) {
      productsCount = 8; // Slightly zoomed out
    } else if (zoomPercentage >= 80) {
      productsCount = 12; // Slightly zoomed out
    } else if (zoomPercentage >= 75) {
      productsCount = 10; // More zoomed out
    } else if (zoomPercentage >= 50) {
      productsCount = 12; // Very zoomed out
    } else {
      productsCount = 15; // Extremely zoomed out
    }
    
    setProductsPerPage(productsCount);
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const warehouseId = getCurrentWarehouse();

      if (!warehouseId) {
        console.warn("No warehouse assigned to user");
        setProducts([]);
        return;
      }

      const res = await api.get(`/products/?warehouse_id=${warehouseId}`);
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

  // Set up view mode specific logic
  useEffect(() => {
    if (viewMode === 'carousel') {
      // Initial calculation for carousel
      const timer = setTimeout(calculateProductsPerPage, 300);

      const handleResize = () => {
        setTimeout(calculateProductsPerPage, 200);
      };

      const handleZoom = (e) => {
        if (e.ctrlKey || e.metaKey) {
          setTimeout(calculateProductsPerPage, 300);
        }
      };

      const handleKeyZoom = (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '0')) {
          setTimeout(calculateProductsPerPage, 300);
        }
      };

      // Listen for various zoom/resize events
      window.addEventListener('resize', handleResize);
      window.addEventListener('wheel', handleZoom, { passive: true });
      window.addEventListener('keydown', handleKeyZoom);
      window.addEventListener('focus', calculateProductsPerPage);
      
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('wheel', handleZoom);
        window.removeEventListener('keydown', handleKeyZoom);
        window.removeEventListener('focus', calculateProductsPerPage);
      };
    }
  }, [viewMode, calculateProductsPerPage]);

  // Update pagination visibility when products or productsPerPage changes
  useEffect(() => {
    if (viewMode === 'table') {
      // For table view, NEVER show pagination - always show all products
      setShowPagination(false);
    } else {
      // For carousel view, use dynamic pagination
      setShowPagination(products.length > productsPerPage);
    }
    setCurrentPage(0); // Reset to first page when products change
  }, [products.length, productsPerPage, viewMode]);

  const totalPages = Math.ceil(products.length / productsPerPage);
  const startIndex = currentPage * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  
  // For table view, ALWAYS show all products. For carousel, use pagination
  const currentProducts = viewMode === 'table' 
    ? products 
    : products.slice(startIndex, endIndex);

  const nextPage = () => {
    setCurrentPage(prev => (prev + 1) % totalPages);
  };

  const prevPage = () => {
    setCurrentPage(prev => (prev - 1 + totalPages) % totalPages);
  };

  const goToPage = (pageIndex) => {
    setCurrentPage(pageIndex);
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setDropdownOpen(false);
    setCurrentPage(0); // Reset to first page when view changes
  };

  // ✅ ENHANCED: Delete handler with notifications
  const handleDelete = async (id) => {
    // Find the product before deletion for notification
    const productToDelete = products.find(p => p.id === id);
    
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
        await api.delete(`/products/${id}/?warehouse_id=${warehouseId}`);
        
        // Update state to remove deleted product
        setProducts(prev => prev.filter(prod => prod.id !== id));
        
        // ✅ NEW: Trigger delete notification
        if (productToDelete) {
          console.log('📦 Product deleted:', productToDelete);
          
          notifyProductChange({
            action: 'deleted',
            id: productToDelete.id,
            product_name: productToDelete.product_name,
            product_code: productToDelete.system_code,
            category: productToDelete.product_category?.name || 'Unknown',
            selling_price: productToDelete.price?.selling_price || 0
          });
          
          console.log('📦 Product deletion notification sent!');
        }
        
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginRight: 'auto' }}>
          <h2 className="page-title" style={{ margin: 0 }}>Product List</h2>
          
          {/* View Mode Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                border: '1px solid #e5e7eb',
                background: '#fff',
                color: '#374151',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                minWidth: '120px',
                justifyContent: 'space-between'
              }}
            >
              <span>{viewMode === 'carousel' ? 'Carousel View' : 'Table View'}</span>
              <FaChevronDown style={{ 
                fontSize: '12px',
                transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }} />
            </button>
            
            {dropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                zIndex: 10,
                overflow: 'hidden'
              }}>
                <button
                  onClick={() => handleViewModeChange('carousel')}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: 'none',
                    background: viewMode === 'carousel' ? '#f3f4f6' : '#fff',
                    color: '#374151',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: viewMode === 'carousel' ? '600' : '400'
                  }}
                  onMouseEnter={(e) => {
                    if (viewMode !== 'carousel') {
                      e.target.style.background = '#f9fafb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (viewMode !== 'carousel') {
                      e.target.style.background = '#fff';
                    }
                  }}
                >
                  Carousel View
                </button>
                <button
                  onClick={() => handleViewModeChange('table')}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: 'none',
                    background: viewMode === 'table' ? '#f3f4f6' : '#fff',
                    color: '#374151',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: viewMode === 'table' ? '600' : '400'
                  }}
                  onMouseEnter={(e) => {
                    if (viewMode !== 'table') {
                      e.target.style.background = '#f9fafb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (viewMode !== 'table') {
                      e.target.style.background = '#fff';
                    }
                  }}
                >
                  Table View
                </button>
              </div>
            )}
          </div>
        </div>
        
        <Link
          to="/products/new"
          className={`btn ${canCreate("Product") ? 'btn-add' : 'btn-disabled'}`}
          onClick={(e) => { if (!canCreate("Product")) e.preventDefault(); }}
        >
          + Add Product
        </Link>
      </div>

      {/* Close dropdown when clicking outside */}
      {dropdownOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 5
          }}
          onClick={() => setDropdownOpen(false)}
        />
      )}

      {/* Empty state */}
      {products.length === 0 ? (
        <div className="empty-state">
          <p className="text-muted">No products found in your warehouse.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View - Shows ALL products with scroll */
        <>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            overflow: 'hidden',
            maxHeight: '70vh', // Limit height to enable scrolling
            overflowY: 'auto'   // Enable vertical scrolling
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ 
                position: 'sticky', 
                top: 0, 
                background: '#f9fafb',
                zIndex: 1
              }}>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                    Product Name
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                    System Code
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                    Supplier Code
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                    Category
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentProducts.map((prod, index) => (
                  <tr key={prod.id} style={{ 
                    borderBottom: index < currentProducts.length - 1 ? '1px solid #f3f4f6' : 'none',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                  >
                    <td style={{ padding: '16px', fontSize: '14px', color: '#374151', fontWeight: '500' }}>
                      {prod.product_name}
                    </td>
                    <td style={{ padding: '16px', fontSize: '14px', color: '#6b7280' }}>
                      {prod.system_code}
                    </td>
                    <td style={{ padding: '16px', fontSize: '14px', color: '#6b7280' }}>
                      {prod.supplier_code}
                    </td>
                    <td style={{ padding: '16px', fontSize: '14px', color: '#6b7280' }}>
                      {prod.product_category?.name || "N/A"}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                        {canEdit("Product") ? (
                          <Link 
                            to={`/products/${prod.id}/edit`} 
                            title="Edit" 
                            className="icon-btn icon-btn-edit" 
                            style={{ padding: '8px', fontSize: '14px' }}
                          >
                            <FaEdit aria-hidden="true" />
                          </Link>
                        ) : (
                          <span 
                            title="No access" 
                            className="icon-btn icon-btn-disabled" 
                            style={{ padding: '8px', fontSize: '14px' }}
                          >
                            <FaEdit aria-hidden="true" />
                          </span>
                        )}
                        {canDelete("Product") ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(prod.id)}
                            title="Delete"
                            className="icon-btn icon-btn-danger"
                            style={{ padding: '8px', fontSize: '14px' }}
                          >
                            <FaTrash aria-hidden="true" />
                          </button>
                        ) : (
                          <span 
                            title="No access" 
                            className="icon-btn icon-btn-disabled" 
                            style={{ padding: '8px', fontSize: '14px' }}
                          >
                            <FaTrash aria-hidden="true" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Product Count Info for Table */}
          <div style={{
            textAlign: 'center',
            marginTop: 16,
            color: '#6b7280',
            fontSize: '14px'
          }}>
            Showing all {products.length} products
          </div>
        </>
      ) : (
        /* Carousel View (Original) */
        <>
          <div 
            ref={gridRef}
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
              gap: 24 
            }}
          >
            {currentProducts.map(prod => (
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

          {/* Carousel Pagination Controls - Only for Carousel View */}
          {showPagination && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 20,
              marginTop: 40,
              padding: '20px 0',
              borderTop: '1px solid #e5e7eb'
            }}>
              {/* Previous Button */}
              <button
                onClick={prevPage}
                disabled={currentPage === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 20px',
                  border: '1px solid #e5e7eb',
                  background: currentPage === 0 ? '#f8f9fa' : '#fff',
                  color: currentPage === 0 ? '#9ca3af' : '#374151',
                  borderRadius: '8px',
                  cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== 0) {
                    e.target.style.background = '#f3f4f6';
                    e.target.style.borderColor = '#d1d5db';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== 0) {
                    e.target.style.background = '#fff';
                    e.target.style.borderColor = '#e5e7eb';
                  }
                }}
              >
                <FaChevronLeft style={{ fontSize: '12px' }} />
                Previous
              </button>

              {/* Page Indicators */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                {/* Page Dots */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {Array.from({ length: totalPages }).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToPage(index)}
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        border: 'none',
                        background: index === currentPage ? '#5D5CDE' : '#d1d5db',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (index !== currentPage) {
                          e.target.style.background = '#9ca3af';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (index !== currentPage) {
                          e.target.style.background = '#d1d5db';
                        }
                      }}
                    />
                  ))}
                </div>

                {/* Page Numbers */}
                <span style={{ 
                  color: '#6b7280', 
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  {currentPage + 1} of {totalPages}
                </span>
              </div>

              {/* Next Button */}
              <button
                onClick={nextPage}
                disabled={currentPage >= totalPages - 1}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 20px',
                  border: '1px solid #e5e7eb',
                  background: currentPage >= totalPages - 1 ? '#f8f9fa' : '#fff',
                  color: currentPage >= totalPages - 1 ? '#9ca3af' : '#374151',
                  borderRadius: '8px',
                  cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
                onMouseEnter={(e) => {
                  if (currentPage < totalPages - 1) {
                    e.target.style.background = '#f3f4f6';
                    e.target.style.borderColor = '#d1d5db';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage < totalPages - 1) {
                    e.target.style.background = '#fff';
                    e.target.style.borderColor = '#e5e7eb';
                  }
                }}
              >
                Next
                <FaChevronRight style={{ fontSize: '12px' }} />
              </button>
            </div>
          )}

          {/* Product Count Info - Only for Carousel View */}
          {showPagination && (
            <div style={{
              textAlign: 'center',
              marginTop: 16,
              color: '#6b7280',
              fontSize: '14px'
            }}>
              Showing {startIndex + 1}-{Math.min(endIndex, products.length)} of {products.length} products
              <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.8 }}>
                ({productsPerPage} per page)
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProductList;