import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";

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
    
    // For admin users, prioritize selected warehouse, fallback to enrolled warehouse
    if (user.role?.toLowerCase() === "admin") {
      if (selectedWarehouse) {
        return { id: selectedWarehouse.id, name: selectedWarehouse.name };
      }
    }
    
    // For non-admin users or admin without selected warehouse, use enrolled warehouse
    if (user.warehouse_id && user.warehouse) {
      return { id: user.warehouse_id, name: user.warehouse };
    }
    
    return null;
  }, []);

  // Update current warehouse when component mounts or warehouse changes
  useEffect(() => {
    const updateWarehouse = () => {
      const warehouse = getCurrentWarehouse();
      setCurrentWarehouse(warehouse);
    };
    
    updateWarehouse();
    
    // Listen for warehouse changes
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
      console.log("Raw suppliers response:", response.data);
      
      let suppliersData = response.data;
      if (suppliersData.results) suppliersData = suppliersData.results;
      if (suppliersData.data) suppliersData = suppliersData.data;
      
      console.log("Processed suppliers:", suppliersData);
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
      console.log("Raw products response:", response.data);
      
      let productsData = response.data;
      if (productsData.results) productsData = productsData.results;
      if (productsData.data) productsData = productsData.data;
      
      console.log("Processed products:", productsData);
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
      console.log("Raw pricing response:", response.data);
      
      let pricingData = response.data;
      if (pricingData.results) pricingData = pricingData.results;
      if (pricingData.data) pricingData = pricingData.data;
      
      console.log("Processed pricing:", pricingData);
      setPricing(Array.isArray(pricingData) ? pricingData : []);
    } catch (error) {
      console.error("Error fetching pricing:", error);
      setError("Failed to load pricing data");
      setPricing([]);
    }
  }, [currentWarehouse]);

  const fetchReturnedEmptiesFromMerchandising = useCallback(async () => {
    if (!currentWarehouse) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.get(`http://localhost:8080/api/merchandisings/?warehouse=${currentWarehouse.id}`);
      console.log("Raw merchandising response:", response.data);
      
      let merchandisingData = response.data;
      if (merchandisingData.results) merchandisingData = merchandisingData.results;
      if (merchandisingData.data) merchandisingData = merchandisingData.data;
      
      const emptyReturns = [];
      
      if (Array.isArray(merchandisingData)) {
        merchandisingData.forEach(merchandising => {
          console.log("Processing merchandising item:", merchandising);
          
          // FIXED: Check for both "Complete" and "COMPLETE" status to include van load transactions
          if ((merchandising.status === "Complete" || merchandising.status === "COMPLETE") && merchandising.items) {
            merchandising.items.forEach(item => {
              console.log("Full item structure:", JSON.stringify(item, null, 2));
              
              const emptyShell = item.empty_return_shell || 0;
              const emptyPcs = item.empty_return_pcs || 0;
              
              if (emptyShell > 0 || emptyPcs > 0) {
                // Get product ID from the item (it's stored directly as 'product')
                let productId = item.product;
                let productName = '';
                let supplierId = null;
                let supplierName = '';
                
                console.log("Product ID from item:", productId);
                
                // Find the product in the products array
                const product = products.find(p => p.id === productId);
                if (product) {
                  // Find pricing for this product
                  const productPricing = pricing.find(p => p.id === productId);
                  
                  if (!productPricing) {
                    console.log("No pricing found for product:", product.product_name);
                    return; // Skip if no pricing data
                  }
                  
                  // Check if product has shell_price or bottle_price in pricing table
                  const hasShellPrice = productPricing.shell_price && 
                                      productPricing.shell_price > 0 && 
                                      productPricing.shell_price !== null;
                  
                  const hasBottlePrice = productPricing.bottle_price && 
                                       productPricing.bottle_price > 0 && 
                                       productPricing.bottle_price !== null;
                  
                  if (!hasShellPrice && !hasBottlePrice) {
                    console.log("Skipping product with no shell/bottle price:", product.product_name, 
                              "Shell price:", productPricing.shell_price, 
                              "Bottle price:", productPricing.bottle_price);
                    return; // Skip this item - no shell or bottle price means no returnable empties
                  }
                  
                  productName = product.product_name;
                  supplierId = product.supplier; // This is the supplier ID
                  console.log("Found product with shell/bottle price:", productName, 
                            "Shell price:", productPricing.shell_price,
                            "Bottle price:", productPricing.bottle_price,
                            "Supplier ID:", supplierId);
                  
                  // Find the supplier in the suppliers array
                  const supplier = suppliers.find(s => s.id === supplierId);
                  if (supplier) {
                    supplierName = supplier.company_name;
                    console.log("Found supplier:", supplierName);
                  }
                } else {
                  // If product not found, skip this item since we can't verify pricing
                  console.log("Product not found, skipping item with product ID:", productId);
                  return;
                }
                
                // Final fallback values
                if (!productName) {
                  productName = `Unknown Product (ID: ${productId || 'undefined'})`;
                }
                
                if (!supplierName) {
                  supplierName = `Unknown Supplier (ID: ${supplierId || 'undefined'})`;
                }

                console.log("Final Names - Product:", productName, "Supplier:", supplierName);

                const productPricing = pricing.find(p => p.id === productId);

                emptyReturns.push({
                  id: `${merchandising.id}-${item.id}`,
                  msp_no: merchandising.msp_no,
                  product_name: productName,
                  empty_return_shell: emptyShell,
                  empty_return_pcs: emptyPcs,
                  supplier_name: supplierName,
                  supplier_id: supplierId,
                  product_id: productId,
                  date: merchandising.date_time ? merchandising.date_time.split('T')[0] : "N/A",
                  merchandising_id: merchandising.id,
                  item_id: item.id,
                  shell_price: productPricing ? productPricing.shell_price : 0,
                  bottle_price: productPricing ? productPricing.bottle_price : 0,
                  warehouse_id: currentWarehouse.id,
                  warehouse_name: currentWarehouse.name,
                  transaction_type: merchandising.status // Add transaction type for better visibility
                });
              }
            });
          }
        });
      }
      
      // Group and aggregate empty returns by product
      const groupedReturns = {};
      
      emptyReturns.forEach(item => {
        const key = item.product_id;
        
        if (groupedReturns[key]) {
          // Combine with existing product
          groupedReturns[key].empty_return_shell += item.empty_return_shell;
          groupedReturns[key].empty_return_pcs += item.empty_return_pcs;
          groupedReturns[key].msp_numbers.push(item.msp_no);
          groupedReturns[key].transaction_count += 1;
          // Keep track of transaction types
          if (!groupedReturns[key].transaction_types.includes(item.transaction_type)) {
            groupedReturns[key].transaction_types.push(item.transaction_type);
          }
          // Keep track of all dates, take the most recent
          if (item.date > groupedReturns[key].date) {
            groupedReturns[key].date = item.date;
          }
        } else {
          // Create new entry
          groupedReturns[key] = {
            ...item,
            msp_numbers: [item.msp_no],
            transaction_count: 1,
            transaction_types: [item.transaction_type],
            id: `grouped-${key}` // New ID for grouped item
          };
        }
      });
      
      // Convert back to array
      const aggregatedReturns = Object.values(groupedReturns);
      
      console.log("Processed empty returns (with shell/bottle pricing only):", emptyReturns);
      console.log("Aggregated empty returns:", aggregatedReturns);
      setReturnedEmpties(aggregatedReturns);
      setError(null);
    } catch (error) {
      console.error("Error fetching merchandising returns:", error);
      setError("Failed to load merchandising data");
      setReturnedEmpties([]);
    }
    setLoading(false);
  }, [products, suppliers, pricing, currentWarehouse]);

  // Process return empties to stock
  const processReturnEmpties = async () => {
    if (!currentWarehouse || filteredEmpties.length === 0) {
      setError("No warehouse selected or no empties to process");
      return;
    }

    try {
      setLoading(true);
      
      const processData = {
        return_date: new Date().toISOString(),
        warehouse_id: currentWarehouse.id,
        items: filteredEmpties.map(item => ({
          merchandising_id: item.merchandising_id,
          item_id: item.item_id,
          product_id: item.product_id,
          supplier_id: item.supplier_id,
          product_name: item.product_name,
          empty_return_shell: item.empty_return_shell,
          empty_return_pcs: item.empty_return_pcs,
          warehouse_id: currentWarehouse.id
        }))
      };

      const response = await axios.post('http://localhost:8080/api/process-empties-return/', processData);
      
      if (response.data.message) {
        // Refresh the data after processing
        await fetchReturnedEmptiesFromMerchandising();
        setError(null);
        // You might want to show a success message here
        console.log("Successfully processed empties return:", response.data);
      }
    } catch (error) {
      console.error("Error processing empties return:", error);
      setError("Failed to process empties return");
    } finally {
      setLoading(false);
    }
  };

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
      <div className="min-h-screen bg-white p-6 flex items-center justify-center">
        <div className="text-red-600 text-center">
          <h2 className="text-xl font-bold mb-2">No Warehouse Selected</h2>
          <p>Please select a warehouse to view return empties.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-6 flex items-center justify-center">
        <div className="text-gray-600">Loading returned empties for {currentWarehouse.name}...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6">
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {/* Warehouse Info Header */}
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h2 className="text-lg font-bold text-blue-800">Return Empties - {currentWarehouse.name}</h2>
        <p className="text-sm text-blue-600">Showing return empties data for this warehouse only (includes both regular and van load transactions)</p>
      </div>
      
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <label className="text-gray-700 font-medium">Search:</label>
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 min-w-[200px]"
          >
            <option value="">Filter by Supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.company_name || supplier.name}>
                {supplier.company_name || supplier.name}
              </option>
            ))}
          </select>
          
          {filteredEmpties.length > 0 && (
            <button
              onClick={processReturnEmpties}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              disabled={loading}
            >
              {loading ? "Processing..." : "Process Return to Stock"}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-gray-700 font-medium border-b">MSP No(s).</th>
              <th className="px-4 py-3 text-left text-gray-700 font-medium border-b">Product</th>
              <th className="px-4 py-3 text-center text-gray-700 font-medium border-b">Total Empty Returns</th>
              <th className="px-4 py-3 text-left text-gray-700 font-medium border-b">Supplier</th>
              <th className="px-4 py-3 text-center text-gray-700 font-medium border-b">Transactions</th>
              <th className="px-4 py-3 text-center text-gray-700 font-medium border-b">Type</th>
              <th className="px-4 py-3 text-center text-gray-700 font-medium border-b">Latest Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmpties.length > 0 ? (
              filteredEmpties.map((item, index) => (
                <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-4 py-3 border-b text-gray-800 font-medium">
                    {item.msp_numbers ? (
                      <div className="space-y-1">
                        {item.msp_numbers.slice(0, 2).map((msp, i) => (
                          <div key={i} className="text-sm">{msp}</div>
                        ))}
                        {item.msp_numbers.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{item.msp_numbers.length - 2} more
                          </div>
                        )}
                      </div>
                    ) : (
                      item.msp_no
                    )}
                  </td>
                  <td className="px-4 py-3 border-b text-gray-800">
                    <div className="flex flex-col gap-1">
                      <div>{item.product_name}</div>
                      <div className="flex gap-1">
                        {item.shell_price > 0 && (
                          <span className="bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded">
                            Shell: ₱{item.shell_price}
                          </span>
                        )}
                        {item.bottle_price > 0 && (
                          <span className="bg-green-100 text-green-600 text-xs px-2 py-1 rounded">
                            Bottle: ₱{item.bottle_price}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b text-center text-gray-800">
                    <div className="font-semibold">{item.empty_return_shell} Shell</div>
                    <div className="text-sm text-gray-600">{item.empty_return_pcs} PCs</div>
                  </td>
                  <td className="px-4 py-3 border-b text-gray-800">{item.supplier_name}</td>
                  <td className="px-4 py-3 border-b text-center text-gray-800">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                      {item.transaction_count || 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 border-b text-center text-gray-800">
                    <div className="flex flex-col gap-1">
                      {item.transaction_types && item.transaction_types.map((type, i) => (
                        <span 
                          key={i}
                          className={`text-xs px-2 py-1 rounded ${
                            type === 'COMPLETE' 
                              ? 'bg-purple-100 text-purple-600' 
                              : 'bg-green-100 text-green-600'
                          }`}
                        >
                          {type === 'COMPLETE' ? 'Van Load' : 'Regular'}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b text-center text-gray-800">{item.date}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                  No returned empties available for {currentWarehouse.name}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredEmpties.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
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