// ProductList.jsx - COMPLETE INTEGRATION WITH ALL OLD VERSION FEATURES + SEARCH BAR
import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from "../api"; // ✅ NEW: from new version (was: import axios from "axios")
import { Link } from 'react-router-dom';
import { FaEdit, FaTrash, FaChevronLeft, FaChevronRight, FaChevronDown, FaSearch, FaTimes } from 'react-icons/fa';
import { canCreate, canEdit, canDelete } from '../utils/accessControl';
import { notifyProductChange } from '../utils/productNotifier';
import { getCurrentWarehouse, findWarehouseByName, getWarehouseAxiosConfig } from '../utils/warehouseUtils'; // ✅ KEPT: from old version
import { showAppAlertDialog, showAppConfirmDialog } from "../components/common/modalDialogs";

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [showPagination, setShowPagination] = useState(false);
  const [productsPerPage, setProductsPerPage] = useState(6);
  const [viewMode, setViewMode] = useState('carousel');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentWarehouse, setCurrentWarehouse] = useState(null); // ✅ KEPT: from old version
  const [searchQuery, setSearchQuery] = useState('');
  const gridRef = useRef(null);

  useEffect(() => {
    const event = new CustomEvent('productsPageVisited');
    window.dispatchEvent(event);
  }, []);

  // ✅ KEPT: Proper warehouse setup like ReceivingList (from old version)
  const setupWarehouse = useCallback(async () => {
    console.log('🏭 Setting up warehouse for ProductList...');
   
    const warehouse = getCurrentWarehouse();
   
    if (!warehouse) {
      console.warn('⚠️ No warehouse found for user');
      setCurrentWarehouse(null);
      setLoading(false);
      return;
    }
   
    // If warehouse needs ID lookup, find it by name
    if (warehouse.needsIdLookup) {
      const foundWarehouse = await findWarehouseByName(warehouse.name);
      setCurrentWarehouse(foundWarehouse);
    } else {
      setCurrentWarehouse(warehouse);
    }
   
    setLoading(false);
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!currentWarehouse?.id) {
      console.warn('❌ No warehouse ID available for fetching products');
      setProducts([]);
      return;
    }

    try {
      setLoading(true);
      console.log('📦 Fetching products for warehouse:', currentWarehouse);
     
      // ✅ KEPT: Use same pattern as ReceivingList (from old version)
      const config = getWarehouseAxiosConfig(currentWarehouse);
      const url = `/products/?warehouse_id=${currentWarehouse.id}`;
     
      console.log('📡 Making request to:', url, 'with config:', config);
     
      // ✅ NEW: Use api.get() instead of axios.get() (from new version)
      const res = await api.get(url, config);
     
      console.log('✅ Products fetched successfully:', res.data.length, 'products');
      setProducts(res.data);
    } catch (err) {
      console.error("❌ Error fetching products:", err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [currentWarehouse]);

  // ✅ KEPT: Setup warehouse first, then fetch products (from old version)
  useEffect(() => {
    setupWarehouse();
  }, [setupWarehouse]);

  useEffect(() => {
    if (currentWarehouse?.id) {
      fetchProducts();
    }
  }, [currentWarehouse, fetchProducts]);

  // ✅ KEPT: Listen for warehouse changes (from old version)
  useEffect(() => {
    const handleWarehouseChange = (event) => {
      console.log('🏭 Warehouse change detected in ProductList:', event.detail);
      setupWarehouse();
    };
   
    window.addEventListener('warehouseChanged', handleWarehouseChange);
    return () => window.removeEventListener('warehouseChanged', handleWarehouseChange);
  }, [setupWarehouse]);

  // Filter products based on search query
  const filteredProducts = products.filter(product => {
    if (!searchQuery.trim()) return true;
   
    const query = searchQuery.toLowerCase();
    return (
      product.product_name?.toLowerCase().includes(query) ||
      product.system_code?.toLowerCase().includes(query) ||
      product.supplier_code?.toLowerCase().includes(query) ||
      product.product_category?.name?.toLowerCase().includes(query)
    );
  });

  // Calculate products per page based on zoom level (only for carousel mode)
  const calculateProductsPerPage = useCallback(() => {
    let zoomLevel = 1;
   
    if (window.outerWidth && window.innerWidth) {
      zoomLevel = window.outerWidth / window.innerWidth;
    }
   
    if (zoomLevel === 1 && window.devicePixelRatio) {
      zoomLevel = 1 / window.devicePixelRatio;
    }
   
    const zoomPercentage = Math.round(zoomLevel * 100);
   
    let productsCount = 6;
   
    if (zoomPercentage >= 125) {
      productsCount = 4;
    } else if (zoomPercentage >= 100) {
      productsCount = 6;
    } else if (zoomPercentage >= 90) {
      productsCount = 8;
    } else if (zoomPercentage >= 80) {
      productsCount = 12;
    } else if (zoomPercentage >= 75) {
      productsCount = 10;
    } else if (zoomPercentage >= 50) {
      productsCount = 12;
    } else {
      productsCount = 15;
    }
   
    setProductsPerPage(productsCount);
  }, []);

  // Set up view mode specific logic
  useEffect(() => {
    if (viewMode === 'carousel') {
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

  useEffect(() => {
    if (viewMode === 'table') {
      setShowPagination(false);
    } else {
      setShowPagination(filteredProducts.length > productsPerPage);
    }
    setCurrentPage(0);
  }, [filteredProducts.length, productsPerPage, viewMode]);

  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
  const startIndex = currentPage * productsPerPage;
  const endIndex = startIndex + productsPerPage;
 
  const currentProducts = viewMode === 'table'
    ? filteredProducts
    : filteredProducts.slice(startIndex, endIndex);

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
    setCurrentPage(0);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(0); // Reset to first page when searching
  };

  const clearSearch = () => {
    setSearchQuery('');
    setCurrentPage(0);
  };

  const handleDelete = async (id) => {
    const productToDelete = products.find(p => p.id === id);

    const confirmed = await showAppConfirmDialog({
      title: "Confirm Delete",
      message: "Are you sure you want to delete this product?",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
      size: "sm",
    });

    if (!confirmed) return;

    try {
      // ✅ KEPT: Use warehouse config for delete request (from old version)
      const config = getWarehouseAxiosConfig(currentWarehouse);
      // ✅ NEW: Use api.delete() instead of axios.delete() (from new version)
      await api.delete(`/products/${id}/`, config);
      setProducts(prev => prev.filter(prod => prod.id !== id));
      if (productToDelete) {
        notifyProductChange({
          action: 'deleted',
          id: productToDelete.id,
          product_name: productToDelete.product_name,
          product_code: productToDelete.system_code,
          category: productToDelete.product_category?.name || 'Unknown',
          selling_price: productToDelete.price?.selling_price || 0
        });
      }

      showAppAlertDialog({ message: "Product deleted successfully!", size: "sm" });
    } catch (err) {
      showAppAlertDialog({
        title: "Delete Failed",
        message: "Failed to delete product. " + (err.response?.data?.message || err.message),
        danger: true,
        okLabel: "Close",
        size: "sm",
      });
    }
  };

  // ✅ KEPT: Show loading state while setting up warehouse (from old version)
  if (loading || !currentWarehouse) {
    return (
      <div className="page">
        <div className="loading">
          <div className="spinner" aria-hidden="true"></div>
          <span className="loading-text">
            {!currentWarehouse ? 'Setting up warehouse...' : 'Loading products…'}
          </span>
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
         
          {/* ✅ KEPT: Show current warehouse (from old version) */}
          <div style={{
            padding: '4px 8px',
            background: '#f3f4f6',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#6b7280'
          }}>
            📦 {currentWarehouse.name}
          </div>
         
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
                    color: '#374151', // ✅ KEPT: Fixed typo from old version (#374171 -> #374151)
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
          + Product
        </Link>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ position: 'relative', maxWidth: '500px' }}>
          <div style={{ position: 'relative' }}>
            <FaSearch style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af',
              fontSize: '14px'
            }} />
            <input
              type="text"
              placeholder="Search products by name, system code, supplier code, or category..."
              value={searchQuery}
              onChange={handleSearchChange}
              style={{
                width: '100%',
                padding: '12px 12px 12px 40px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                background: '#fff',
                color: '#374151',
                paddingRight: searchQuery ? '40px' : '12px',
                transition: 'all 0.2s ease',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#5D5CDE';
                e.target.style.boxShadow = '0 0 0 3px rgba(93, 92, 222, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.boxShadow = 'none';
              }}
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Clear search"
                onMouseEnter={(e) => e.target.style.color = '#6b7280'}
                onMouseLeave={(e) => e.target.style.color = '#9ca3af'}
              >
                <FaTimes style={{ fontSize: '12px' }} />
              </button>
            )}
          </div>
        </div>
        {searchQuery && (
          <div style={{
            marginTop: '8px',
            fontSize: '14px',
            color: '#6b7280'
          }}>
            Found {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
            {filteredProducts.length > 0 && ` matching "${searchQuery}"`}
          </div>
        )}
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
          <p className="text-muted">No products found for {currentWarehouse.name}.</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="empty-state">
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <FaSearch style={{ fontSize: '48px', color: '#d1d5db', marginBottom: '16px' }} />
            <h3 style={{ margin: '0 0 8px 0', color: '#374151', fontSize: '18px', fontWeight: '600' }}>
              No products found
            </h3>
            <p className="text-muted" style={{ margin: '0 0 16px 0' }}>
              No products match your search for "{searchQuery}"
            </p>
            <button
              onClick={clearSearch}
              style={{
                padding: '8px 16px',
                background: '#5D5CDE',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Clear search
            </button>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            overflow: 'hidden',
            maxHeight: '70vh',
            overflowY: 'auto'
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
         
          <div style={{
            textAlign: 'center',
            marginTop: 16,
            color: '#6b7280',
            fontSize: '14px'
          }}>
            Showing {searchQuery ? `${filteredProducts.length} filtered` : `all ${products.length}`} products for {currentWarehouse.name}
          </div>
        </>
      ) : (
        /* Carousel View */
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
                <div style={{
                  display: 'flex',
                  gap: 24,
                  alignItems: 'flex-start'
                }}>
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

                  <div style={{ flex: 1, display: 'grid', gap: 16 }}>
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

          {/* Carousel Pagination Controls */}
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

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
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

                <span style={{
                  color: '#6b7280',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  {currentPage + 1} of {totalPages}
                </span>
              </div>

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

          {showPagination && (
            <div style={{
              textAlign: 'center',
              marginTop: 16,
              color: '#6b7280',
              fontSize: '14px'
            }}>
              Showing {startIndex + 1}-{Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} {searchQuery ? 'filtered ' : ''}products for {currentWarehouse.name}
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
