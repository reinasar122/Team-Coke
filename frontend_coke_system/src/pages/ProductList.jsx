// ProductList.jsx - COMPLETE INTEGRATION WITH ALL OLD VERSION FEATURES + SEARCH BAR
import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from "../api"; // ✅ NEW: from new version (was: import axios from "axios")
import { Link } from 'react-router-dom';
import { FaEdit, FaTrash, FaChevronLeft, FaChevronRight, FaSearch, FaWarehouse } from 'react-icons/fa';
import { AiFillProduct } from "react-icons/ai";
import { canCreate, canEdit, canDelete } from '../utils/accessControl';
import { notifyProductChange } from '../utils/productNotifier';
import { getCurrentWarehouse, findWarehouseByName, getWarehouseAxiosConfig } from '../utils/warehouseUtils'; // ✅ KEPT: from old version
import { resolveProductImage } from '../utils/productImages';
import { showAppAlertDialog, showAppConfirmDialog } from "../components/common/modalDialogs";
import PageSearchToolbar, { PageToolbarSelect } from "../components/common/PageSearchToolbar";
import '../styles/pages/productlist.scss';

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [showPagination, setShowPagination] = useState(false);
  const [productsPerPage, setProductsPerPage] = useState(6);
  const [carouselColumns, setCarouselColumns] = useState(3);
  const [viewMode, setViewMode] = useState('carousel');
  const [currentWarehouse, setCurrentWarehouse] = useState(null); // ✅ KEPT: from old version
  const [searchQuery, setSearchQuery] = useState('');
  const [brokenImages, setBrokenImages] = useState({});
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

  // Keep carousel paging tied to available width so each page stays compact.
  const calculateProductsPerPage = useCallback(() => {
    const availableWidth = gridRef.current?.offsetWidth || window.innerWidth;

    let nextProductsPerPage = 1;
    let nextCarouselColumns = 1;

    if (availableWidth >= 1320) {
      nextProductsPerPage = 6;
      nextCarouselColumns = 3;
    } else if (availableWidth >= 920) {
      nextProductsPerPage = 4;
      nextCarouselColumns = 2;
    } else {
      nextProductsPerPage = 2;
      nextCarouselColumns = 1;
    }

    setProductsPerPage(nextProductsPerPage);
    setCarouselColumns(nextCarouselColumns);
  }, []);

  // Set up view mode specific logic
  useEffect(() => {
    if (viewMode === 'carousel') {
      const queueMeasure = () => window.requestAnimationFrame(calculateProductsPerPage);
      const timer = window.setTimeout(queueMeasure, 0);

      const handleResize = () => {
        queueMeasure();
      };

      const resizeObserver =
        typeof ResizeObserver !== 'undefined' && gridRef.current
          ? new ResizeObserver(() => queueMeasure())
          : null;

      if (resizeObserver && gridRef.current) {
        resizeObserver.observe(gridRef.current);
      }

      window.addEventListener('resize', handleResize);
      window.addEventListener('focus', queueMeasure);
     
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('focus', queueMeasure);
        resizeObserver?.disconnect();
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

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / productsPerPage));
  const startIndex = currentPage * productsPerPage;
  const endIndex = startIndex + productsPerPage;
 
  const currentProducts = viewMode === 'table'
    ? filteredProducts
    : filteredProducts.slice(startIndex, endIndex);

  const visibleCarouselColumns = Math.max(1, carouselColumns);
  const isCompactCarousel = productsPerPage >= 6;
  const carouselGridGap = isCompactCarousel ? 16 : 20;
  const carouselCardPadding = isCompactCarousel ? 18 : carouselColumns >= 2 ? 20 : 24;
  const carouselPreviewSize = isCompactCarousel ? '148px' : carouselColumns >= 2 ? '168px' : '184px';
  const carouselTitleSize = isCompactCarousel ? '16px' : '18px';
  const carouselMetaFontSize = isCompactCarousel ? '13px' : '14px';
  const carouselActionPadding = isCompactCarousel ? '8px' : '10px';
  const carouselLayoutStyle = {
    gridTemplateColumns: `repeat(${visibleCarouselColumns}, minmax(0, 1fr))`,
    '--product-carousel-gap': `${carouselGridGap}px`,
    '--product-carousel-preview-size': carouselPreviewSize,
    '--product-carousel-title-size': carouselTitleSize,
    '--product-carousel-meta-size': carouselMetaFontSize,
    '--product-carousel-action-padding': carouselActionPadding,
  };

  const nextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages - 1));
  };

  const prevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 0));
  };

  const handleImageError = useCallback((productId) => {
    setBrokenImages(prev => (prev[productId] ? prev : { ...prev, [productId]: true }));
  }, []);

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setCurrentPage(0);
  };

  const handleSearchChange = (value) => {
    setSearchQuery(value);
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
    <div className="page product-list-page">
      {/* Header */}
      <div className="page-header product-list-page__header">
        <div className="flex flex-wrap items-center gap-6 min-w-0">
          <h2 className="page-title" style={{ margin: 0 }}>
            <AiFillProduct /> Product List
          </h2>
          <span className="page-warehouse-chip">
            <span className="page-warehouse-chip__icon" aria-hidden="true"><FaWarehouse /></span>
            <span className="page-warehouse-chip__text">{currentWarehouse.name}</span>
          </span>
        </div>

        <Link
          to="/products/new"
          className={`btn app-page-create-btn ${canCreate("Product") ? 'btn-add' : 'btn-disabled'}`}
          onClick={(e) => { if (!canCreate("Product")) e.preventDefault(); }}
          title={canCreate("Product") ? "Add Product" : "No permission to add products"}
        >
          + Product
        </Link>
      </div>

      <PageSearchToolbar
        className="product-list-page__toolbar"
        value={searchQuery}
        onChange={handleSearchChange}
        onClear={clearSearch}
        placeholder="Search products by name, system code, supplier code, or category..."
        controls={
          <PageToolbarSelect
            value={viewMode}
            onChange={(event) => handleViewModeChange(event.target.value)}
            ariaLabel="Select product view"
            options={[
              { value: 'carousel', label: 'Carousel View' },
              { value: 'table', label: 'Table View' },
            ]}
          />
        }
        summary={
          searchQuery
            ? `Found ${filteredProducts.length} product${filteredProducts.length !== 1 ? 's' : ''}${filteredProducts.length > 0 ? ` matching "${searchQuery}"` : ''}`
            : null
        }
      />
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
          <div className="table-wrapper" style={{ maxHeight: '70vh' }}>
            <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse' }}>
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
            className="product-carousel-shell"
            data-columns={visibleCarouselColumns}
            style={carouselLayoutStyle}
          >
            {currentProducts.map(prod => {
              const productImageSrc = brokenImages[prod.id]
                ? null
                : resolveProductImage(prod);

              return (
              <div
                key={prod.id}
                className="card product-carousel-card"
                style={{
                  '--product-carousel-card-padding': `${carouselCardPadding}px`,
                }}
              >
                <div className="product-carousel-card__media">
                  {productImageSrc ? (
                      <img
                        src={productImageSrc}
                        alt={prod.product_name}
                        className="product-carousel-card__preview"
                        onError={() => handleImageError(prod.id)}
                      />
                    ) : (
                      <div className="product-carousel-card__placeholder">
                        <div className="product-carousel-card__placeholder-content">
                          <div style={{ fontSize: '34px', lineHeight: 1 }}>📷</div>
                          <div className="product-carousel-card__placeholder-text">No product image</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="product-carousel-card__body">
                    <div className="product-carousel-card__content">
                    <h3 className="product-carousel-card__title">
                      {prod.product_name}
                    </h3>

                    <div className="product-carousel-card__meta">
                      <div className="product-carousel-card__meta-row">
                        <span className="text-muted product-carousel-card__meta-label">System Code:</span>
                        <span className="product-carousel-card__meta-value">
                          {prod.system_code}
                        </span>
                      </div>
                      <div className="product-carousel-card__meta-row">
                        <span className="text-muted product-carousel-card__meta-label">Supplier Code:</span>
                        <span className="product-carousel-card__meta-value">
                          {prod.supplier_code}
                        </span>
                      </div>
                      <div className="product-carousel-card__meta-row">
                        <span className="text-muted product-carousel-card__meta-label">Category:</span>
                        <span className="product-carousel-card__meta-value">
                          {prod.product_category?.name || "N/A"}
                        </span>
                      </div>
                    </div>
                    </div>

                    <div className="product-carousel-card__actions">
                      {canEdit("Product") ? (
                        <Link to={`/products/${prod.id}/edit`} title="Edit" className="icon-btn icon-btn-edit product-carousel-card__action">
                          <FaEdit aria-hidden="true" />
                          <span className="sr-only">Edit</span>
                        </Link>
                      ) : (
                        <span title="No access" className="icon-btn icon-btn-disabled product-carousel-card__action">
                          <FaEdit aria-hidden="true" />
                          <span className="sr-only">No edit access</span>
                        </span>
                      )}
                      {canDelete("Product") ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(prod.id)}
                          title="Delete"
                          className="icon-btn icon-btn-danger product-carousel-card__action"
                        >
                          <FaTrash aria-hidden="true" />
                          <span className="sr-only">Delete</span>
                        </button>
                      ) : (
                        <span title="No access" className="icon-btn icon-btn-disabled product-carousel-card__action">
                          <FaTrash aria-hidden="true" />
                          <span className="sr-only">No delete access</span>
                        </span>
                      )}
                    </div>
                  </div>
              </div>
              );
            })}
          </div>

          {/* Carousel Pagination Controls */}
          {showPagination && (
            <div className="product-carousel-footer">
              <div className="product-carousel-footer__controls">
                <button
                  type="button"
                  onClick={prevPage}
                  disabled={currentPage === 0}
                  className="product-carousel-footer__button"
                >
                  <FaChevronLeft className="product-carousel-footer__button-icon" />
                  Previous
                </button>

                <span className="product-carousel-footer__page-indicator">
                  {currentPage + 1} / {totalPages}
                </span>

                <button
                  type="button"
                  onClick={nextPage}
                  disabled={currentPage >= totalPages - 1}
                  className="product-carousel-footer__button"
                >
                  Next
                  <FaChevronRight className="product-carousel-footer__button-icon" />
                </button>
              </div>

              <span className="product-carousel-footer__summary">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} {searchQuery ? 'filtered ' : ''}products for {currentWarehouse.name}
                <span className="product-carousel-footer__summary-note">
                  ({productsPerPage} per page)
                </span>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProductList;



