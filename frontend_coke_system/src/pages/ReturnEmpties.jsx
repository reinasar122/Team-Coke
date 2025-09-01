import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";

import "../styles/pages/returnempties.scss";

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
      const response = await axios.get(`http://localhost:8080/api/suppliers/?warehouse=${currentWarehouse.id}`);
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
      const response = await axios.get(`http://localhost:8080/api/products/?warehouse=${currentWarehouse.id}`);
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
      const response = await axios.get(`http://localhost:8080/api/pricing/?warehouse=${currentWarehouse.id}`);
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
      const response = await axios.get(`http://localhost:8080/api/merchandisings/?warehouse=${currentWarehouse.id}`);
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
      <div className="min-h-screen bg-white dark:bg-gray-900 p-6 flex items-center justify-center">
        <div className="text-red-600 text-center">
          <h2 className="text-xl font-bold mb-2">No Warehouse Selected</h2>
          <p>Please select a warehouse to view return empties.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 p-6 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-300">Loading returned empties...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-6">
      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 rounded">
          {error}
        </div>
      )}
      
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <label className="text-gray-700 dark:text-gray-300 font-medium">Search:</label>
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 min-w-[200px] text-base"
          >
            <option value="">Filter by Supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.company_name || supplier.name}>
                {supplier.company_name || supplier.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              {/* <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 font-medium border-b dark:border-gray-600">MSP No(s).</th> */}
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 font-medium border-b dark:border-gray-600">Product</th>
              <th className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-medium border-b dark:border-gray-600">Total Empty Returns</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 font-medium border-b dark:border-gray-600">Supplier</th>
              <th className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-medium border-b dark:border-gray-600">Transactions</th>
              <th className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-medium border-b dark:border-gray-600">Type</th>
              <th className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-medium border-b dark:border-gray-600">Latest Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmpties.length > 0 ? (
              filteredEmpties.map((item, index) => (
                <tr key={item.id} className={index % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-750"}>
                  {/* <td className="px-4 py-3 border-b dark:border-gray-600 text-gray-800 dark:text-gray-200 font-medium">
                    {item.msp_numbers ? (
                      <div className="space-y-1">
                        {item.msp_numbers.slice(0, 2).map((msp, i) => (
                          <div key={i} className="text-sm">{msp}</div>
                        ))}
                        {item.msp_numbers.length > 2 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            +{item.msp_numbers.length - 2} more
                          </div>
                        )}
                      </div>
                    ) : (
                      item.msp_no
                    )}
                  </td> */}
                  <td className="px-4 py-3 border-b dark:border-gray-600 text-gray-800 dark:text-gray-200">
                    <div className="flex flex-col gap-1">
                      <div>{item.product_name}</div>
                      <div className="flex gap-1">
                        {item.shell_price > 0 && (
                          <span className="bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 text-xs px-2 py-1 rounded">
                            Shell: ₱{item.shell_price}
                          </span>
                        )}
                        {item.bottle_price > 0 && (
                          <span className="bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-300 text-xs px-2 py-1 rounded">
                            Bottle: ₱{item.bottle_price}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b dark:border-gray-600 text-center text-gray-800 dark:text-gray-200">
                    <div className="font-semibold">{item.empty_return_shell} Shell</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{item.empty_return_pcs} PCs</div>
                  </td>
                  <td className="px-4 py-3 border-b dark:border-gray-600 text-gray-800 dark:text-gray-200">{item.supplier_name}</td>
                  <td className="px-4 py-3 border-b dark:border-gray-600 text-center text-gray-800 dark:text-gray-200">
                    <span className="bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full text-sm">
                      {item.transaction_count || 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 border-b dark:border-gray-600 text-center text-gray-800 dark:text-gray-200">
                    <div className="flex flex-col gap-1">
                      {item.transaction_types && item.transaction_types.map((type, i) => (
                        <span 
                          key={i}
                          className={`text-xs px-2 py-1 rounded ${
                            type === 'Van Load' 
                              ? 'bg-purple-100 dark:bg-purple-800 text-purple-600 dark:text-purple-300' 
                              : 'bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-300'
                          }`}
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b dark:border-gray-600 text-center text-gray-800 dark:text-gray-200">{item.date}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No returned empties available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredEmpties.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <span className="font-medium">Unique Products: </span>
              {filteredEmpties.length}
            </div>
            <div>
              <span className="font-medium">Total Transactions: </span>
              {filteredEmpties.reduce((sum, item) => sum + (item.transaction_count || 1), 0)}
            </div>
            <div>
              <span className="font-medium">Total Shells: </span>
              {filteredEmpties.reduce((sum, item) => sum + item.empty_return_shell, 0)}
            </div>
            <div>
              <span className="font-medium">Total PCs: </span>
              {filteredEmpties.reduce((sum, item) => sum + item.empty_return_pcs, 0)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnEmpties;