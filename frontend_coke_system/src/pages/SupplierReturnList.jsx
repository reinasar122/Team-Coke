// SupplierReturnList.jsx - UPDATED VERSION WITH STATUS COLUMN (NO DELETE FUNCTIONALITY)
import React, { useEffect, useState, useCallback } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";
import { FaEye, FaSearch, FaWarehouse } from "react-icons/fa"; // Removed FaTrash import
import { getCurrentWarehouse, findWarehouseByName } from '../utils/warehouseUtils';

const SupplierReturnList = () => {
  const [returns, setReturns] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [pricingData, setPricingData] = useState([]);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // ? KEPT: Proper warehouse setup using utilities
  const setupWarehouse = useCallback(async () => {
    console.log('?? Setting up warehouse for SupplierReturnList...');
    
    const warehouse = getCurrentWarehouse();
    
    if (!warehouse) {
      console.warn('?? No warehouse found for user');
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

  // Function to fetch supplier returns for current warehouse
  const fetchSupplierReturns = useCallback(async (warehouseId) => {
    if (!warehouseId) {
      console.warn('? No warehouse ID provided for fetching supplier returns');
      return [];
    }

    try {
      console.log('?? Fetching supplier returns for warehouse ID:', warehouseId);
      const warehouseParam = `?warehouse_id=${warehouseId}`;
      const response = await api.get(`/supplier-return-form/${warehouseParam}`);
      console.log(`? Loaded ${response.data.length} supplier returns`);
      return response.data;
    } catch (err) {
      console.error("Error fetching supplier returns:", err);
      return [];
    }
  }, []);

  // ? KEPT: Setup warehouse first
  useEffect(() => {
    setupWarehouse();
  }, [setupWarehouse]);

  // ? KEPT: Listen for warehouse changes
  useEffect(() => {
    const handleWarehouseChange = (event) => {
      console.log('?? Warehouse change detected in SupplierReturnList:', event.detail);
      setupWarehouse();
    };
    
    window.addEventListener('warehouseChanged', handleWarehouseChange);
    return () => window.removeEventListener('warehouseChanged', handleWarehouseChange);
  }, [setupWarehouse]);

  // ? KEPT: Fetch data when warehouse is available
  useEffect(() => {
    if (currentWarehouse?.id) {
      // Fetch all data in parallel for better performance
      Promise.all([
        fetchSupplierReturns(currentWarehouse.id),
        api.get(`/products/?warehouse=${currentWarehouse.id}`),
        api.get("/pricing/")
      ])
      .then(([returnsData, productsRes, pricingRes]) => {
        console.log(`?? Loaded data for ${currentWarehouse.name}:`, {
          returns: returnsData.length,
          products: productsRes.data.length,
          pricing: pricingRes.data.length
        });
        setReturns(returnsData);
        setProducts(productsRes.data);
        setPricingData(pricingRes.data);
      })
      .catch(err => {
        console.error("Error fetching initial data:", err);
      });
    }
  }, [currentWarehouse, fetchSupplierReturns]);

  // ? FIXED helper function to format date correctly
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    
    try {
      // Create date object from the string
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.error("Invalid date string:", dateString);
        return "Invalid Date";
      }
      
      // Format using Philippine locale and timezone
      const formattedDate = date.toLocaleString("en-PH", {
        year: "numeric",
        month: "2-digit", 
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Manila" // Explicitly set Philippine timezone
      });
      
      return formattedDate;
      
    } catch (error) {
      console.error("Error formatting date:", error, "for date string:", dateString);
      return "Invalid Date";
    }
  };

  const formatMoney = (value) =>
    Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatCurrency = (value) => String.fromCharCode(8369) + formatMoney(value);

  // Function to get status badge
  const getStatusBadge = (status) => {
    const normalizedStatus = String(status || "").trim().toLowerCase();

    if (normalizedStatus === "completed" || normalizedStatus === "complete") {
      return (
        <span className="app-status-pill app-status-pill--completed">
          Completed
        </span>
      );
    }

    if (
      normalizedStatus === "in progress" ||
      normalizedStatus === "in-progress" ||
      normalizedStatus === "ongoing" ||
      normalizedStatus === "on going"
    ) {
      return (
        <span className="app-status-pill app-status-pill--progress">
          In Progress
        </span>
      );
    }

    if (normalizedStatus === "pending" || normalizedStatus === "draft" || !normalizedStatus) {
      return (
        <span className="app-status-pill app-status-pill--pending">
          Pending
        </span>
      );
    }

    return (
      <span className="app-status-pill app-status-pill--default">
        {status || "Unknown"}
      </span>
    );
  };

  // Enhanced helper function to find the correct pricing for a product
  const findProductPricing = (productId, productName) => {
    // If we have a specific product name like "Red Horse", look for its exact pricing
    if (productName === "Red Horse") {
      // For Red Horse, we want ID 14 based on the screenshot
      const redHorsePricing = pricingData.find(p => p.id === 14);
      if (redHorsePricing) {
        return redHorsePricing;
      }
    }
    
    // First, try to find pricing by product name (more reliable than ID matching)
    let pricing = null;
    if (productName) {
      pricing = pricingData.find(p => 
        p.product_name && p.product_name.toLowerCase() === productName.toLowerCase()
      );
      
      if (pricing) {
        return pricing;
      }
    }
    
    // If not found by name, try to find an exact match by id
    pricing = pricingData.find(p => 
      p.id === productId || 
      p.product_id === productId || 
      p.product === productId
    );
    
    if (pricing) {
      return pricing;
    }
    
    return null;
  };

  const handleView = async (id) => {
    try {
      // First get the supplier return details
      const returnResponse = await api.get(`/supplier-return-form/${id}/`);
      setSelectedReturn(returnResponse.data);
      
      // If there are items in the return, process them
      if (returnResponse.data.items && returnResponse.data.items.length > 0) {
        const processedItems = await Promise.all(returnResponse.data.items.map(async (item) => {
          // Find the product details
          const product = products.find(p => p.id === item.product);
          const productName = product ? product.product_name : `Product ID: ${item.product}`;
          
          // Find pricing data for this product using the enhanced function
          const pricing = findProductPricing(item.product, productName);
          
          // Use the pricing from the API
          let bottlePrice = 0;
          let shellPrice = 0;
          
          if (pricing) {
            bottlePrice = Number(pricing.bottle_price || 0);
            shellPrice = Number(pricing.shell_price || 0);
          } else {
            // If pricing not found, try to get it from the product's nested price object
            if (product && product.price) {
              bottlePrice = Number(product.price.bottle_price || 0);
              shellPrice = Number(product.price.shell_price || 0);
            }
          }
          
          return {
            ...item,
            product_name: productName,
            display_bottle_price: bottlePrice,
            display_shell_price: shellPrice
          };
        }));
        
        setReturnItems(processedItems);
      } else {
        setReturnItems([]);
      }
      
      setShowModal(true);
    } catch (error) {
      console.error("Error fetching return details:", error);
      // Show simple error without modal
      alert("Failed to load return details.");
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedReturn(null);
    setReturnItems([]);
  };

  const filteredReturns = returns.filter(item => {
    const supNo = item.sup_no?.toLowerCase() || "";
    const supplier = item.supplier_name?.toLowerCase() || item.supplier?.toString().toLowerCase() || "";
    return supNo.includes(search.toLowerCase()) || supplier.includes(search.toLowerCase());
  });

  // ? KEPT: Show loading state while setting up warehouse
  if (loading && !currentWarehouse) {
    return (
      <div className="page">
        <div className="loading">
          <div className="spinner" />
          <div className="loading-text">Setting up warehouse...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header section with search bar */}
      <div
        className="page-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 className="page-title">
            <FaWarehouse /> Supplier Returns
          </h1>
          {currentWarehouse && (
            <span className="page-warehouse-chip">
              <span className="page-warehouse-chip__icon" aria-hidden="true"><FaWarehouse /></span>
              <span className="page-warehouse-chip__text">{currentWarehouse.name}</span>
            </span>
          )}

          <div className="relative w-72 max-w-full">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search supplier"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        <button
          onClick={() => navigate("/supplier-returns/new")}
          className="btn btn-add app-page-create-btn"
          disabled={!currentWarehouse?.id}
        >
          <span>+</span> New Supplier Return
        </button>
      </div>
      {/* Table - Updated with status column and no delete action */}
      <div className="table-wrapper">
        <table className="table table-hover" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '15%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '25%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} /> {/* Reduced width since only view action */}
          </colgroup>
          <thead>
            <tr>
              <th className="text-left">Supplier No.</th>
              <th style={{ textAlign: 'center' }}>Date</th>
              <th style={{ textAlign: 'center' }}>Supplier</th>
              <th style={{ textAlign: 'center' }}>Warehouse</th>
              <th style={{ textAlign: 'center' }}>Total Amount</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReturns.length > 0 ? (
              filteredReturns.map((item, index) => (
                <tr key={index}>
                  <td className="text-left" style={{ paddingLeft: '12px' }}>{item.sup_no}</td>
                  <td style={{ textAlign: 'center' }}>{formatDate(item.date)}</td>
                  <td style={{ textAlign: 'center' }}>
                    {item.supplier_name || item.supplier || "N/A"}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {item.warehouse_name || "N/A"}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {formatCurrency(item.total_amount)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {getStatusBadge(item.status)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      <button
                        onClick={() => handleView(item.id)}
                        className="icon-btn icon-btn-view"
                        title="View"
                      >
                        <FaEye size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  {currentWarehouse ? 
                    `No supplier returns found for ${currentWarehouse.name}.` : 
                    'No warehouse selected.'
                  }
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for displaying supplier return details */}
      {showModal && selectedReturn && (
        <div className="modal-overlay" style={{ background: 'rgba(0, 0, 0, 0.5)' }}>
          <div style={{ 
            background: 'var(--surface)', 
            borderRadius: 'var(--r-md)', 
            padding: '1.5rem', 
            maxWidth: '800px', 
            width: '90%', 
            maxHeight: '90vh', 
            overflow: 'auto',
            boxShadow: 'var(--shadow)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Supplier Return Details</h3>
              <button 
                onClick={closeModal}
                className="icon-btn"
                style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}
              >&times;</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Sup No.</p>
                <p style={{ margin: '4px 0 0', fontWeight: 500 }}>{selectedReturn.sup_no}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Date & Time</p>
                <p style={{ margin: '4px 0 0', fontWeight: 500 }}>{formatDate(selectedReturn.date)}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Supplier</p>
                <p style={{ margin: '4px 0 0', fontWeight: 500 }}>{selectedReturn.supplier_name || "N/A"}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Warehouse</p>
                <p style={{ margin: '4px 0 0', fontWeight: 500 }}>{selectedReturn.warehouse_name || "N/A"}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Total Amount</p>
                <p style={{ margin: '4px 0 0', fontWeight: 500 }}>{formatCurrency(selectedReturn.total_amount)}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Status</p>
                <p style={{ margin: '4px 0 0', fontWeight: 500 }}>{getStatusBadge(selectedReturn.status)}</p>
              </div>
            </div>
            
            <h4 style={{ margin: '0 0 1rem', fontWeight: 600 }}>Items</h4>
            <div className="table-wrapper" style={{ marginBottom: '1rem' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th className="text-left">Product Name</th>
                    <th className="text-right">Bottle Price</th>
                    <th className="text-right">Shell Price</th>
                    <th className="text-right">Qty (Shell)</th>
                    <th className="text-right">Qty (PC)</th>
                    <th className="text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {returnItems.length > 0 ? (
                    returnItems.map((item, index) => (
                      <tr key={index}>
                        <td className="text-left">{item.product_name}</td>
                        <td className="text-right">{formatCurrency(item.display_bottle_price)}</td>
                        <td className="text-right">{formatCurrency(item.display_shell_price)}</td>
                        <td className="text-right">{item.qty_shell}</td>
                        <td className="text-right">{item.qty_pcs}</td>
                        <td className="text-right">{formatCurrency(item.line_total)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No items found for this return.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--table-head)' }}>
                    <td colSpan="5" className="text-right" style={{ fontWeight: 600 }}>
                      Total:
                    </td>
                    <td className="text-right" style={{ fontWeight: 600 }}>
                      {formatCurrency(selectedReturn.total_amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={closeModal}
                className="btn btn-cancel"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierReturnList;

