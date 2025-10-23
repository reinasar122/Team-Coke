import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import api from "../api"; // ✅ correct

const ReturnEmpties = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [returnedEmpties, setReturnedEmpties] = useState([]);
  const [filteredEmpties, setFilteredEmpties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Get current warehouse information
  const getCurrentWarehouse = useCallback(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    
    if (user.role?.toLowerCase() === "admin") {
      if (selectedWarehouse) {
        return { id: selectedWarehouse.id, name: selectedWarehouse.name };
      }
    }
    
    if (user.warehouse_id && user.warehouse) {
      return { id: user.warehouse_id, name: user.warehouse };
    }
    
    return null;
  }, []);

  useEffect(() => {
    const updateWarehouse = () => {
      const warehouse = getCurrentWarehouse();
      setCurrentWarehouse(warehouse);
    };
    
    updateWarehouse();
    
    const handleWarehouseChange = () => {
      updateWarehouse();
    };
    
    window.addEventListener('warehouseChanged', handleWarehouseChange);
    
    return () => {
      window.removeEventListener('warehouseChanged', handleWarehouseChange);
    };
  }, [getCurrentWarehouse]);

  const fetchSuppliers = useCallback(async () => {
    if (!currentWarehouse) return;
    
    try {
      const response = await api.get(`/suppliers/?warehouse=${currentWarehouse.id}`);
      let suppliersData = response.data;
      if (suppliersData.results) suppliersData = suppliersData.results;
      if (suppliersData.data) suppliersData = suppliersData.data;
      
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      setError("Failed to load suppliers");
      setSuppliers([]);
    }
  }, [currentWarehouse]);

  const fetchProducts = useCallback(async () => {
    if (!currentWarehouse) return;
    
    try {
      const response = await api.get(`/products/?warehouse=${currentWarehouse.id}`);
      let productsData = response.data;
      if (productsData.results) productsData = productsData.results;
      if (productsData.data) productsData = productsData.data;
      
      setProducts(Array.isArray(productsData) ? productsData : []);
    } catch (error) {
      console.error("Error fetching products:", error);
      setError("Failed to load products");
      setProducts([]);
    }
  }, [currentWarehouse]);

  const fetchPricing = useCallback(async () => {
    if (!currentWarehouse) return;
    
    try {
      const response = await api.get(`/pricing/?warehouse=${currentWarehouse.id}`);
      let pricingData = response.data;
      if (pricingData.results) pricingData = pricingData.results;
      if (pricingData.data) pricingData = pricingData.data;
      
      setPricing(Array.isArray(pricingData) ? pricingData : []);
    } catch (error) {
      console.error("Error fetching pricing:", error);
      setError("Failed to load pricing data");
      setPricing([]);
    }
  }, [currentWarehouse]);

  // FIXED: Enhanced empty returns processing - ONLY empty containers (no products with contents)
  const fetchReturnedEmptiesFromMerchandising = useCallback(async () => {
    if (!currentWarehouse) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.get(`/merchandisings/?warehouse=${currentWarehouse.id}`);
      let merchandisingData = response.data;
      if (merchandisingData.results) merchandisingData = merchandisingData.results;
      if (merchandisingData.data) merchandisingData = merchandisingData.data;
      
      const emptyReturns = [];
      
      if (Array.isArray(merchandisingData)) {
        merchandisingData.forEach(merchandising => {
          // Process both Warehouse and Van Load transactions
          if ((merchandising.transaction_type_name === "Warehouse" || merchandising.transaction_type_name === "Van Load") && merchandising.items) {
            
            merchandising.items.forEach(item => {
              // FIXED: Only consider EMPTY returns (exclude products with contents)
              let emptyShell = 0;
              let emptyPcs = 0;
              
              if (merchandising.transaction_type_name === "Warehouse") {
                // For warehouse transactions, ONLY consider empty return fields (not products with contents)
                emptyShell = parseInt(item.empty_return_shell) || 0;
                emptyPcs = parseInt(item.empty_return_pcs) || 0;
                
                console.log(`🏪 Warehouse empty return for item ${item.id}:`, {
                  empty_return_shell: item.empty_return_shell,
                  empty_return_pcs: item.empty_return_pcs,
                  calculated_shell: emptyShell,
                  calculated_pcs: emptyPcs,
                  // Excluded fields (products with contents):
                  excluded_actual_return_shell: item.actual_return_shell,
                  excluded_actual_return_pcs: item.actual_return_pcs
                });
                
              } else if (merchandising.transaction_type_name === "Van Load") {
                // For van load, ONLY consider empty return fields (not products with contents)
                emptyShell = parseInt(item.empty_return_shell) || 0;
                emptyPcs = parseInt(item.empty_return_pcs) || 0;
                
                console.log(`🚐 Van Load empty return for item ${item.id}:`, {
                  empty_return_shell: item.empty_return_shell,
                  empty_return_pcs: item.empty_return_pcs,
                  calculated_shell: emptyShell,
                  calculated_pcs: emptyPcs,
                  // Excluded fields (products with contents):
                  excluded_actual_return_shell: item.actual_return_shell,
                  excluded_actual_return_pcs: item.actual_return_pcs
                });
              }
              
              // Include if either shell or pcs has EMPTY returns (not products with contents)
              if (emptyShell > 0 || emptyPcs > 0) {
                const productId = item.product;
                const product = products.find(p => p.id === productId);
                
                if (product) {
                  const productPricing = pricing.find(p => p.id === productId);
                  
                  // Include if product has pricing
                  if (productPricing && (productPricing.shell_price > 0 || productPricing.bottle_price > 0)) {
                    const supplier = suppliers.find(s => s.id === product.supplier);
                    
                    emptyReturns.push({
                      id: `${merchandising.id}-${item.id}`,
                      msp_no: merchandising.msp_no,
                      product_name: product.product_name,
                      empty_return_shell: emptyShell,
                      empty_return_pcs: emptyPcs,
                      supplier_name: supplier ? supplier.company_name : 'Unknown Supplier',
                      supplier_id: product.supplier,
                      product_id: productId,
                      date: merchandising.date_time ? merchandising.date_time.split('T')[0] : "N/A",
                      merchandising_id: merchandising.id,
                      item_id: item.id,
                      shell_price: productPricing.shell_price || 0,
                      bottle_price: productPricing.bottle_price || 0,
                      warehouse_id: currentWarehouse.id,
                      warehouse_name: currentWarehouse.name,
                      transaction_type: merchandising.transaction_type_name,
                      // Debug info - only empty returns
                      raw_item_data: {
                        empty_return_shell: item.empty_return_shell,
                        empty_return_pcs: item.empty_return_pcs,
                        // Note: actual_return fields excluded as they contain products with contents
                      }
                    });
                  }
                }
              }
            });
          }
        });
      }
      
      // Enhanced grouping with better debugging
      const groupedReturns = {};
      
      emptyReturns.forEach(item => {
        const key = item.product_id;
        
        if (groupedReturns[key]) {
          groupedReturns[key].empty_return_shell += item.empty_return_shell;
          groupedReturns[key].empty_return_pcs += item.empty_return_pcs;
          groupedReturns[key].msp_numbers.push(item.msp_no);
          groupedReturns[key].transaction_count += 1;
          if (!groupedReturns[key].transaction_types.includes(item.transaction_type)) {
            groupedReturns[key].transaction_types.push(item.transaction_type);
          }
          if (item.date > groupedReturns[key].date) {
            groupedReturns[key].date = item.date;
          }
        } else {
          groupedReturns[key] = {
            ...item,
            msp_numbers: [item.msp_no],
            transaction_count: 1,
            transaction_types: [item.transaction_type],
            id: `grouped-${key}`
          };
        }
      });
      
      const aggregatedReturns = Object.values(groupedReturns);
      
      console.log(`📊 Processed ${emptyReturns.length} individual EMPTY returns into ${aggregatedReturns.length} grouped returns`);
      console.log("🔍 Sample grouped empty return:", aggregatedReturns[0]);
      
      setReturnedEmpties(aggregatedReturns);
      setError(null);
    } catch (error) {
      console.error("Error fetching merchandising returns:", error);
      setError("Failed to load merchandising data");
      setReturnedEmpties([]);
    }
    setLoading(false);
  }, [products, suppliers, pricing, currentWarehouse]);

  useEffect(() => {
    if (currentWarehouse) {
      fetchSuppliers();
      fetchProducts();
      fetchPricing();
    }
  }, [currentWarehouse, fetchSuppliers, fetchProducts, fetchPricing]);

  useEffect(() => {
    if (currentWarehouse && suppliers.length > 0 && products.length > 0 && pricing.length > 0) {
      fetchReturnedEmptiesFromMerchandising();
    }
  }, [currentWarehouse, suppliers, products, pricing, fetchReturnedEmptiesFromMerchandising]);

  useEffect(() => {
    if (selectedSupplier) {
      const filtered = returnedEmpties.filter(item => 
        item.supplier_name?.toLowerCase().includes(selectedSupplier.toLowerCase())
      );
      setFilteredEmpties(filtered);
    } else {
      setFilteredEmpties(returnedEmpties);
    }
  }, [selectedSupplier, returnedEmpties]);

  if (!currentWarehouse) {
    return (
      <div className="loading">
        <div className="spinner" />
        <div className="loading-text">No warehouse selected. Please select a warehouse to view return empties.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <div className="loading-text">Loading returned empties...</div>
      </div>
    );
  }

  return (
    <div className="page">
      {error && (
        <div style={{ 
          marginBottom: '1rem', 
          padding: '1rem', 
          background: '#fee2e2', 
          border: '1px solid #fca5a5', 
          color: '#b91c1c', 
          borderRadius: 'var(--r-md)' 
        }}>
          {error}
        </div>
      )}
      
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Supplier dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="btn btn-ghost"
              style={{ 
                fontSize: '1rem', 
                fontWeight: 600, 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '8px 16px'
              }}
            >
              📦 {selectedSupplier || "All Suppliers"}
              <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>

            {dropdownOpen && (
              <div style={{
                position: 'absolute',
                left: 0,
                top: '100%',
                marginTop: '4px',
                width: '220px',
                background: 'var(--surface)',
                boxShadow: 'var(--shadow)',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)',
                zIndex: 10,
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                <button
                  onClick={() => {
                    setSelectedSupplier("");
                    setDropdownOpen(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'var(--ghost-hover)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  All Suppliers
                </button>
                {suppliers.map((supplier) => (
                  <button
                    key={supplier.id}
                    onClick={() => {
                      setSelectedSupplier(supplier.company_name || supplier.name);
                      setDropdownOpen(false);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                    onMouseEnter={(e) => e.target.style.background = 'var(--ghost-hover)'}
                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                  >
                    {supplier.company_name || supplier.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="actions">
          <div style={{ 
            padding: '8px 12px', 
            background: 'var(--table-head)', 
            borderRadius: 'var(--r-sm)', 
            fontSize: '0.875rem',
            color: 'var(--text-muted)'
          }}>
            {currentWarehouse.name}
          </div>
        </div>
      </div>

      {/* Table - Same structure as UserList */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th className="text-left">Product</th>
              <th>Total Empty Returns</th>
              <th>Supplier</th>
              <th>Transactions</th>
              <th>Type</th>
              <th>Latest Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmpties.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-muted" style={{ textAlign: "center", padding: 24 }}>
                  No returned empties available for {currentWarehouse.name}
                </td>
              </tr>
            ) : (
              filteredEmpties.map((item, index) => (
                <tr key={item.id}>
                  <td className="text-left">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontWeight: 500 }}>{item.product_name}</div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {item.shell_price > 0 && (
                          <span style={{ 
                            background: '#dbeafe', 
                            color: '#2563eb', 
                            fontSize: '0.75rem', 
                            padding: '2px 6px', 
                            borderRadius: '4px' 
                          }}>
                            Shell: ₱{item.shell_price}
                          </span>
                        )}
                        {item.bottle_price > 0 && (
                          <span style={{ 
                            background: '#dcfce7', 
                            color: '#16a34a', 
                            fontSize: '0.75rem', 
                            padding: '2px 6px', 
                            borderRadius: '4px' 
                          }}>
                            Bottle: ₱{item.bottle_price}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600 }}>{item.empty_return_shell} Shell</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{item.empty_return_pcs} PCs</div>
                  </td>
                  <td>{item.supplier_name}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ 
                      background: '#dbeafe', 
                      color: '#1e40af', 
                      padding: '4px 8px', 
                      borderRadius: '50px', 
                      fontSize: '0.875rem' 
                    }}>
                      {item.transaction_count || 1}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                      {item.transaction_types && item.transaction_types.map((type, i) => (
                        <span 
                          key={i}
                          style={{
                            fontSize: '0.75rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: type === 'Van Load' ? '#f3e8ff' : '#dcfce7',
                            color: type === 'Van Load' ? '#7c3aed' : '#16a34a'
                          }}
                        >
                          {type === 'Warehouse' ? 'Warehouse' : type}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>{item.date}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReturnEmpties;