// SupplierReturnForm.js - Updated with date/time fixes
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const SupplierReturnForm = () => {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);

  // Returns local date & time in YYYY-MM-DDTHH:MM format - FIXED
  const getLocalDateTime = () => {
    const now = new Date();
    // Get local date and time components
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    // Return in YYYY-MM-DDTHH:MM format for datetime-local input
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const generateRandomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `SUP-${code}`;
  };

  const [form, setForm] = useState({
    sup_no: generateRandomCode(),
    supplier: "",
    warehouse: "",
    date: getLocalDateTime(),
    total_amount: 0,
    items: [{
      product: "",
      product_name: "",
      content_no: 0,
      bottle_price: 0,
      shell_price: 0,
      qty_shell: "0",
      qty_pcs: "0",
      line_total: 0,
    }],
  });

  // Store ALL merchandising items that contributed to the supplier return
  const [merchandisingItemsToClean, setMerchandisingItemsToClean] = useState([]);

  // Function to get current warehouse
  const getCurrentWarehouse = useCallback(() => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    
    // For admin users, use selected warehouse or their enrolled warehouse
    if (userData.role?.toLowerCase() === "admin") {
      return selectedWarehouse || { id: userData.warehouse_id, name: userData.warehouse };
    }
    
    // For non-admin users, always use their enrolled warehouse
    return { id: userData.warehouse_id, name: userData.warehouse };
  }, []);

  // Function to fetch return empties for selected supplier FROM MERCHANDISING DATA
  const fetchReturnEmpties = useCallback(async (supplierId) => {
    try {
      console.log("🔍 Fetching return empties from merchandising for supplier:", supplierId, "warehouse:", currentWarehouse?.id);
      console.log("📦 Available products:", products.length);
      console.log("💰 Available pricing:", pricing.length);
      
      const warehouseParam = currentWarehouse?.id ? `?warehouse_id=${currentWarehouse.id}` : '';
      const response = await axios.get(`http://localhost:8080/api/merchandisings/${warehouseParam}`);
      console.log("📦 All merchandising data:", response.data);
      
      let merchandisingData = response.data;
      if (merchandisingData.results) merchandisingData = merchandisingData.results;
      if (merchandisingData.data) merchandisingData = merchandisingData.data;
      
      const emptyReturns = [];
      const itemsToClean = []; // Track ALL items that will be used
      
      if (Array.isArray(merchandisingData)) {
        merchandisingData.forEach(merchandising => {
          // Check for both "Complete" and "COMPLETE" status (warehouse and van load transactions)
          // AND ensure merchandising belongs to current warehouse
          const belongsToCurrentWarehouse = !currentWarehouse?.id || 
            String(merchandising.warehouse_id) === String(currentWarehouse.id) ||
            String(merchandising.warehouse) === String(currentWarehouse.id);
            
          if ((merchandising.status === "Complete" || merchandising.status === "COMPLETE") && 
              merchandising.items && belongsToCurrentWarehouse) {
            console.log(`📋 Processing ${merchandising.status} transaction: ${merchandising.msp_no} from warehouse: ${merchandising.warehouse_id || merchandising.warehouse}`);
            
            merchandising.items.forEach(item => {
              const emptyShell = item.empty_return_shell || 0;
              const emptyPcs = item.empty_return_pcs || 0;
              
              if (emptyShell > 0 || emptyPcs > 0) {
                // Get product info
                const product = products.find(p => p.id === item.product);
                
                if (product && String(product.supplier) === String(supplierId)) {
                  console.log(`🔍 Found product for supplier: ${product.product_name} - Supplier: ${product.supplier}`);
                  
                  // IMPORTANT: Check pricing like in ReturnEmpties component
                  const productPricing = pricing.find(p => p.id === item.product);
                  
                  if (!productPricing) {
                    console.log(`❌ No pricing found for product: ${product.product_name}, skipping`);
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
                    console.log(`❌ Skipping product with no shell/bottle price: ${product.product_name}`, 
                              "Shell price:", productPricing.shell_price, 
                              "Bottle price:", productPricing.bottle_price);
                    return; // Skip this item - no shell or bottle price means no returnable empties
                  }
                  
                  console.log(`✅ Found returnable product with pricing: ${product.product_name}`, 
                            "Shell price:", productPricing.shell_price,
                            "Bottle price:", productPricing.bottle_price,
                            "Empty shells:", emptyShell,
                            "Empty pcs:", emptyPcs);
                  
                  const returnItem = {
                    id: `${merchandising.id}-${item.id}`,
                    product_id: item.product,
                    product_name: product.product_name,
                    empty_shell_qty: emptyShell,
                    empty_bottle_qty: emptyPcs,
                    qty_shell: emptyShell,
                    qty_pcs: emptyPcs,
                    supplier_id: supplierId,
                    merchandising_id: merchandising.id,
                    item_id: item.id,
                    msp_no: merchandising.msp_no,
                    warehouse_id: currentWarehouse?.id,
                    shell_price: productPricing.shell_price || 0,
                    bottle_price: productPricing.bottle_price || 0
                  };
                  
                  emptyReturns.push(returnItem);
                  
                  // Add to items that need to be cleaned
                  itemsToClean.push({
                    merchandising_id: merchandising.id,
                    item_id: item.id,
                    product_id: item.product,
                    supplier_id: supplierId,
                    empty_shell_qty: emptyShell,
                    empty_bottle_qty: emptyPcs,
                    msp_no: merchandising.msp_no,
                    original_empty_shell: emptyShell,
                    original_empty_pcs: emptyPcs
                  });
                } else {
                  if (product) {
                    console.log(`❌ Product excluded - wrong supplier: ${product.product_name} - Product supplier: ${product.supplier}, Selected supplier: ${supplierId}`);
                  } else {
                    console.log(`❌ Product not found for item.product: ${item.product}`);
                  }
                }
              }
            });
          } else {
            const warehouseInfo = merchandising.warehouse_id || merchandising.warehouse || 'unknown';
            const statusInfo = merchandising.status || 'unknown';
            console.log(`⏭️ Skipping transaction - Status: ${statusInfo}, Warehouse: ${warehouseInfo}, Current warehouse: ${currentWarehouse?.id} (MSP: ${merchandising.msp_no})`);
          }
        });
      }
      
      console.log("✅ Filtered return empties from merchandising for supplier ID:", supplierId, "in warehouse:", currentWarehouse?.name, emptyReturns);
      console.log("📋 Items to clean after return:", itemsToClean);
      
      // Store the data for later processing
      setMerchandisingItemsToClean(itemsToClean);
      
      return emptyReturns;
    } catch (err) {
      console.error("❌ Error fetching return empties from merchandising for supplier:", supplierId, err);
      return [];
    }
  }, [currentWarehouse, products, pricing]);

  // Helper function to format a number to 2 decimal places and convert to a number
  const formatDecimal = (value) => {
    return Number(parseFloat(value || 0).toFixed(2));
  };

  // Function to populate table with return empties data - combine duplicate products
  const populateTableWithReturnEmpties = useCallback((returnEmptiesData) => {
    if (!returnEmptiesData || returnEmptiesData.length === 0) {
      console.log("No return empties found for this supplier in current warehouse");
      setForm(prev => ({
        ...prev,
        items: [{
          product: "",
          product_name: "",
          content_no: 0,
          bottle_price: 0,
          shell_price: 0,
          qty_shell: "0",
          qty_pcs: "0",
          line_total: 0,
        }],
        total_amount: 0
      }));
      setMerchandisingItemsToClean([]);
      return;
    }

    console.log("🔄 Processing return empties data:", returnEmptiesData);
    
    // Group products by product name to combine duplicates
    const productGroups = {};

    returnEmptiesData.forEach(empty => {
      const product = products.find(p => 
        p.id === empty.product_id || p.id === empty.product
      );
      
      if (product) {
        const productName = product.product_name;
        const contentNo = product.unit_type?.content_no || 0;
        // Use pricing from the empty return data
        const bottlePrice = formatDecimal(empty.bottle_price || 0);
        const shellPrice = formatDecimal(empty.shell_price || 0);
        
        const qtyShell = parseInt(empty.empty_shell_qty || empty.qty_shell || 0, 10);
        const qtyPcs = parseInt(empty.empty_bottle_qty || (qtyShell * contentNo), 10);
        
        // If this product name already exists, add to it
        if (productGroups[productName]) {
          productGroups[productName].qty_shell += qtyShell;
          productGroups[productName].qty_pcs += qtyPcs;
        } else {
          // Create new entry for this product
          productGroups[productName] = {
            product: product.id,
            product_name: productName,
            content_no: contentNo,
            bottle_price: bottlePrice,
            shell_price: shellPrice,
            qty_shell: qtyShell,
            qty_pcs: qtyPcs,
          };
        }
      }
    });

    // Convert grouped products to items array
    const newItems = Object.values(productGroups).map(group => {
      const bottleTotal = group.qty_pcs * group.bottle_price;
      const shellTotal = group.qty_shell * group.shell_price;
      const lineTotal = formatDecimal(bottleTotal + shellTotal);
      
      return {
        product: group.product,
        product_name: group.product_name,
        content_no: group.content_no,
        bottle_price: group.bottle_price,
        shell_price: group.shell_price,
        qty_shell: String(group.qty_shell),
        qty_pcs: String(group.qty_pcs),
        line_total: lineTotal,
      };
    });

    // Calculate total amount
    const totalAmount = formatDecimal(
      newItems.reduce((sum, item) => sum + formatDecimal(item.line_total), 0)
    );

    console.log("✅ Setting form with combined products:", {
      itemsCount: newItems.length,
      totalAmount
    });

    setForm(prev => ({
      ...prev,
      items: newItems,
      total_amount: totalAmount
    }));
  }, [products]);

  // Handle supplier change
  const handleSupplierChange = useCallback(async (supplierId) => {
    console.log("🔄 Supplier changed to:", supplierId);
    setForm(prev => ({ ...prev, supplier: supplierId }));
    
    if (supplierId) {
      console.log("🔍 Fetching return empties for supplier:", supplierId, "in warehouse:", currentWarehouse?.name);
      // Fetch and populate return empties for the selected supplier in current warehouse
      const returnEmptiesData = await fetchReturnEmpties(supplierId);
      populateTableWithReturnEmpties(returnEmptiesData);
    } else {
      // Reset to empty form if no supplier selected
      console.log("↻ No supplier selected, resetting form");
      setForm(prev => ({
        ...prev,
        items: [{
          product: "",
          product_name: "",
          content_no: 0,
          bottle_price: 0,
          shell_price: 0,
          qty_shell: "0",
          qty_pcs: "0",
          line_total: 0,
        }],
        total_amount: 0
      }));
      setMerchandisingItemsToClean([]);
    }
  }, [currentWarehouse, fetchReturnEmpties, populateTableWithReturnEmpties]);

  // Initial data loading useEffect
  useEffect(() => {
    // Get current warehouse on component mount
    const warehouse = getCurrentWarehouse();
    setCurrentWarehouse(warehouse);
    
    // Set warehouse in form
    setForm(prev => ({
      ...prev,
      warehouse: warehouse?.id || ""
    }));

    // Fetch all data in parallel
    Promise.all([
      axios.get("http://localhost:8080/api/suppliers/"),
      axios.get("http://localhost:8080/api/pricing/"),
      axios.get("http://localhost:8080/api/products/")
    ])
    .then(([suppliersRes, pricingRes, productsRes]) => {
      // Set suppliers
      setSuppliers(suppliersRes.data);
      
      // Set pricing data
      setPricing(pricingRes.data);
      console.log("💰 Pricing data loaded:", pricingRes.data.length, "entries");
      
      // Set all products (no filtering needed here since we filter by pricing later)
      setProducts(productsRes.data);
      console.log("📦 Products data loaded:", productsRes.data.length, "entries");
    })
    .catch(err => {
      console.error("Error fetching data:", err);
    });
  }, [getCurrentWarehouse]);

  // Separate useEffect for warehouse change listener
  useEffect(() => {
    // Listen for warehouse changes
    const handleWarehouseChange = (event) => {
      const newWarehouse = event.detail.warehouse || getCurrentWarehouse();
      console.log("🏭 Warehouse changed:", newWarehouse);
      setCurrentWarehouse(newWarehouse);
      setForm(prev => ({
        ...prev,
        warehouse: newWarehouse?.id || "",
        supplier: "", // Reset supplier when warehouse changes
        items: [{
          product: "",
          product_name: "",
          content_no: 0,
          bottle_price: 0,
          shell_price: 0,
          qty_shell: "0",
          qty_pcs: "0",
          line_total: 0,
        }],
        total_amount: 0
      }));
      setMerchandisingItemsToClean([]);
    };

    window.addEventListener('warehouseChanged', handleWarehouseChange);

    // Cleanup event listener
    return () => {
      window.removeEventListener('warehouseChanged', handleWarehouseChange);
    };
  }, [getCurrentWarehouse]);

  const handleItemChange = (index, field, value) => {
    // Create a deep copy of the items array
    const updatedItems = [...form.items];
    updatedItems[index] = { ...updatedItems[index] };
    
    // Update the field
    updatedItems[index][field] = value;

    // Only recalculate if qty_shell changed
    if (field === "qty_shell") {
      const item = updatedItems[index];
      
      if (item.product) {
        const contentNo = Number(item.content_no) || 0;
        const bottlePrice = formatDecimal(item.bottle_price);
        const shellPrice = formatDecimal(item.shell_price);
        
        // Convert qty_shell to a number, default to 0 if NaN
        const qtyShell = parseInt(value, 10) || 0;
        
        // Calculate pieces based on content_no
        const qtyPcs = qtyShell * contentNo;
        
        // Calculate line total using precise decimal math
        const bottleTotal = qtyPcs * bottlePrice;
        const shellTotal = qtyShell * shellPrice;
        const lineTotal = formatDecimal(bottleTotal + shellTotal);
        
        // Update the item with the new calculated values
        updatedItems[index] = {
          ...item,
          qty_shell: String(qtyShell),
          qty_pcs: String(qtyPcs),
          line_total: lineTotal
        };
      }
    }
    
    // Calculate total amount by summing all line totals
    let totalAmount = 0;
    updatedItems.forEach(item => {
      totalAmount += formatDecimal(item.line_total);
    });
    totalAmount = formatDecimal(totalAmount);

    // Update form with new items and total
    setForm(prev => ({
      ...prev,
      items: updatedItems,
      total_amount: totalAmount
    }));
  };

  // Function to clear merchandising items empty returns - ALL items that were used
  const clearMerchandisingEmptyReturns = async () => {
    try {
      console.log("🧹 Clearing merchandising empty returns...");
      console.log("📋 Items to clean:", merchandisingItemsToClean);
      
      if (merchandisingItemsToClean.length === 0) {
        console.log("ℹ️ No merchandising items to clear");
        return { cleared: 0, errors: 0 };
      }
      
      let clearedCount = 0;
      let errorCount = 0;
      
      for (const item of merchandisingItemsToClean) {
        try {
          console.log(`🔄 Clearing merchandising item ${item.item_id} from MSP ${item.msp_no}`);
          
          const response = await axios.patch(
            `http://localhost:8080/api/merchandising-items/${item.item_id}/`,
            {
              empty_return_shell: 0,
              empty_return_pcs: 0
            }
          );
          
          console.log(`✅ Cleared merchandising item ${item.item_id}:`, response.data);
          clearedCount++;
          
        } catch (error) {
          console.error(`❌ Failed to clear merchandising item ${item.item_id}:`, error);
          errorCount++;
        }
      }
      
      console.log(`🏁 Merchandising cleanup completed. Cleared: ${clearedCount}, Errors: ${errorCount}`);
      return { cleared: clearedCount, errors: errorCount };
      
    } catch (error) {
      console.error("❌ Error in merchandising cleanup:", error);
      throw error;
    }
  };

  // Function to remove/update returnable stock entries for the returned items
  const removeReturnableStockEntries = async (returnedItems) => {
    try {
      console.log("🗑️ Removing returnable stock entries...");
      console.log("📦 Returned items to process:", returnedItems);
      
      if (!currentWarehouse?.id) {
        console.log("⚠️ No warehouse ID, skipping returnable stock cleanup");
        return { removed: 0, updated: 0, errors: 0 };
      }
      
      // Get all returnable stock data for this warehouse
      const warehouseParam = `?warehouse_id=${currentWarehouse.id}`;
      const response = await axios.get(`http://localhost:8080/api/returnable-stocks/${warehouseParam}`);
      const returnableStocks = response.data;
      
      console.log("📦 All returnable stocks for warehouse:", returnableStocks);
      
      let removedCount = 0;
      let updatedCount = 0;
      let errorCount = 0;
      
      for (const returnedItem of returnedItems) {
        console.log(`\n🔄 Processing returned item: ${returnedItem.product} (${returnedItem.qty_shell} shells, ${returnedItem.qty_pcs} pcs)`);
        
        // Find matching returnable stock entries for this product and supplier in current warehouse
        const matchingStocks = returnableStocks.filter(stock => {
          const productMatch = (stock.product_id === returnedItem.product || stock.product === returnedItem.product);
          const supplierMatch = (String(stock.supplier_id) === String(form.supplier) || String(stock.supplier) === String(form.supplier));
          const warehouseMatch = (String(stock.warehouse_id) === String(currentWarehouse.id));
          
          console.log(`🔍 Checking stock ${stock.id}: Product match: ${productMatch}, Supplier match: ${supplierMatch}, Warehouse match: ${warehouseMatch}`);
          return productMatch && supplierMatch && warehouseMatch;
        });
        
        console.log(`📦 Found ${matchingStocks.length} matching returnable stock entries`);
        
        let remainingShellQty = returnedItem.qty_shell;
        let remainingPcsQty = returnedItem.qty_pcs;
        
        for (const stock of matchingStocks) {
          if (remainingShellQty <= 0 && remainingPcsQty <= 0) break;
          
          const currentShells = stock.empty_shell_qty || 0;
          const currentPcs = stock.empty_bottle_qty || 0;
          
          console.log(`📊 Processing stock ${stock.id}: ${currentShells} shells, ${currentPcs} pcs`);
          
          if (currentShells > 0 || currentPcs > 0) {
            // Calculate how much to subtract
            const shellsToSubtract = Math.min(remainingShellQty, currentShells);
            const pcsToSubtract = Math.min(remainingPcsQty, currentPcs);
            
            const newShells = Math.max(0, currentShells - shellsToSubtract);
            const newPcs = Math.max(0, currentPcs - pcsToSubtract);
            
            console.log(`➖ Subtracting: ${shellsToSubtract} shells, ${pcsToSubtract} pcs`);
            console.log(`📈 New quantities: ${newShells} shells, ${newPcs} pcs`);
            
            try {
              if (newShells <= 0 && newPcs <= 0) {
                // Delete the entire entry
                console.log(`🗑️ Deleting returnable stock entry ${stock.id} (no remaining quantities)`);
                await axios.delete(`http://localhost:8080/api/returnable-stocks/${stock.id}/`);
                removedCount++;
                console.log(`✅ Successfully deleted returnable stock entry ${stock.id}`);
              } else {
                // Update with new quantities
                console.log(`🔄 Updating returnable stock entry ${stock.id}`);
                const updateData = {
                  empty_shell_qty: newShells,
                  empty_bottle_qty: newPcs,
                  last_updated: new Date().toISOString()
                };
                
                console.log("📤 Sending update data:", updateData);
                const updateResponse = await axios.patch(`http://localhost:8080/api/returnable-stocks/${stock.id}/`, updateData);
                console.log("📥 Update response:", updateResponse.data);
                updatedCount++;
                console.log(`✅ Successfully updated returnable stock entry ${stock.id}`);
              }
              
              // Update remaining quantities
              remainingShellQty -= shellsToSubtract;
              remainingPcsQty -= pcsToSubtract;
              
            } catch (error) {
              console.error(`❌ Failed to process returnable stock entry ${stock.id}:`, error);
              console.error("Error details:", error.response?.data);
              errorCount++;
            }
          }
        }
        
        if (remainingShellQty > 0 || remainingPcsQty > 0) {
          console.warn(`⚠️ Could not process all quantities for product ${returnedItem.product}. Remaining: ${remainingShellQty} shells, ${remainingPcsQty} pcs`);
        }
      }
      
      console.log(`\n🏁 Returnable stock cleanup completed:`);
      console.log(`🗑️ Deleted entries: ${removedCount}`);
      console.log(`🔄 Updated entries: ${updatedCount}`);
      console.log(`❌ Errors: ${errorCount}`);
      
      return { removed: removedCount, updated: updatedCount, errors: errorCount };
      
    } catch (error) {
      console.error("❌ Critical error in returnable stock cleanup:", error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate warehouse selection
    if (!currentWarehouse?.id) {
      showErrorModal("No warehouse selected. Please select a warehouse first.");
      return;
    }

    // Check if there are items to process
    const validItems = form.items.filter(item => item.product && (parseInt(item.qty_shell) > 0 || parseInt(item.qty_pcs) > 0));
    
    if (validItems.length === 0) {
      showErrorModal("No valid items to return. Please select a supplier with available return empties.");
      return;
    }

    // Recalculate total one last time
    const totalAmount = formatDecimal(
      form.items.reduce((sum, item) => sum + formatDecimal(item.line_total), 0)
    );

    // Filter out items with no product and include bottle_price and shell_price
    const filteredItems = form.items
      .filter(item => item.product)
      .map(({ product, qty_shell, qty_pcs, bottle_price, shell_price, line_total }) => ({
        product,
        qty_shell: parseInt(qty_shell, 10) || 0,
        qty_pcs: parseInt(qty_pcs, 10) || 0,
        bottle_price: formatDecimal(bottle_price),
        shell_price: formatDecimal(shell_price),
        line_total: formatDecimal(line_total),
      }));

    try {
      console.log("💾 Saving supplier return form...");
      
      // FIXED: Ensure date is saved correctly with timezone info
      const formattedDate = form.date ? new Date(form.date).toISOString() : new Date().toISOString();
      
      // Save the supplier return form
      const response = await axios.post("http://localhost:8080/api/supplier-return-form/", {
        sup_no: form.sup_no,
        supplier: form.supplier,
        warehouse: currentWarehouse.id,
        date: formattedDate, // Use properly formatted date
        total_amount: totalAmount,
        items: filteredItems,
        auto_remove_empties: true
      });
      
      console.log("✅ Supplier return saved successfully:", response.data);

      // STEP 1: Clear merchandising empty returns (DELETE THE DATA)
      console.log("🧹 Step 1: Clearing merchandising empty returns...");
      const merchandisingResult = await clearMerchandisingEmptyReturns();

      // STEP 2: Remove/update returnable stock entries
      console.log("🗑️ Step 2: Cleaning up returnable stock entries...");
      const returnableStockResult = await removeReturnableStockEntries(filteredItems);
      
      let message = `Supplier return saved successfully for ${currentWarehouse.name}!`;
      
      if (merchandisingResult.cleared > 0) {
        message += ` ${merchandisingResult.cleared} merchandising empty return entries have been cleared.`;
      }

      if (returnableStockResult.removed > 0) {
        message += ` ${returnableStockResult.removed} returnable stock entries have been completely removed.`;
      }

      if (returnableStockResult.updated > 0) {
        message += ` ${returnableStockResult.updated} returnable stock entries have been updated with remaining quantities.`;
      }
      
      const totalErrors = (merchandisingResult.errors || 0) + (returnableStockResult.errors || 0);
      if (totalErrors > 0) {
        message += ` Note: ${totalErrors} items had errors during cleanup.`;
      }
      
      message += " Both merchandising and returnable stock data have been updated automatically.";
      
      // Show success modal and redirect
      showSuccessModal(message);
      
    } catch (err) {
      console.error("❌ Save error:", err);
      console.log("Error details:", err.response?.data);
      showErrorModal("Failed to save supplier return.");
    }
  };

  // Custom modal functions
  const showSuccessModal = (message) => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
        <div class="text-green-600 text-center mb-4">
          <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <p class="text-gray-700 dark:text-gray-300 mb-6 text-center">${message}</p>
        <div class="flex justify-center">
          <button class="px-6 py-2 bg-green-500 text-white hover:bg-green-600 rounded" onclick="this.closest('.fixed').remove(); window.location.href='/supplier-returns'">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  const showErrorModal = (message) => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
        <div class="text-red-600 text-center mb-4">
          <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </div>
        <p class="text-gray-700 dark:text-gray-300 mb-6 text-center">${message}</p>
        <div class="flex justify-center">
          <button class="px-6 py-2 bg-red-500 text-white hover:bg-red-600 rounded" onclick="this.closest('.fixed').remove()">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  return (
    <div className="bg-white p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Supplier Return Form</h2>
          
          {/* Warehouse Display */}
          <div className="bg-blue-50 px-4 py-2 rounded-lg">
            <span className="text-blue-800 font-medium">
              {currentWarehouse?.name || "No Warehouse Selected"}
            </span>
          </div>
        </div>
        
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="mb-4">
              <label className="block mb-1 font-medium">Sup No.</label>
              <input 
                type="text" 
                value={form.sup_no} 
                readOnly 
                className="w-full p-3 bg-gray-100 border border-gray-200 rounded"
              />
            </div>
            
            <div className="mb-4">
              <label className="block mb-1 font-medium">Date & Time</label>
              <input
                type="datetime-local"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full p-3 bg-gray-100 border border-gray-200 rounded"
                required
              />
            </div>
          </div>
          
          <div>
            <div className="mb-4">
              <label className="block mb-1 font-medium">Supplier</label>
              <select
                value={form.supplier}
                onChange={(e) => handleSupplierChange(e.target.value)}
                className="w-full p-3 bg-gray-100 border border-gray-200 rounded appearance-none"
                required
              >
                <option value="">Select Supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block mb-1 font-medium">Total Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                <input 
                  type="text" 
                  value={formatDecimal(form.total_amount).toFixed(2)}
                  readOnly
                  className="w-full p-3 pl-7 bg-gray-100 border border-gray-200 rounded"
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="py-3 px-4 text-left font-semibold">Product Name</th>
                <th className="py-3 px-4 text-center font-semibold">Qty (Shell)</th>
                <th className="py-3 px-4 text-center font-semibold">Qty (PC)</th>
                <th className="py-3 px-4 text-center font-semibold">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, index) => (
                <tr key={index} className="border-b border-gray-200">
                  <td className="py-2 px-4">
                    <input
                      type="text"
                      value={item.product_name}
                      readOnly
                      className="w-full p-2 bg-gray-100 border border-gray-200 rounded cursor-not-allowed"
                      placeholder="Auto-populated when supplier is selected"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={item.qty_shell}
                      onFocus={(e) => e.target.value === "0" && handleItemChange(index, "qty_shell", "")}
                      onBlur={(e) => {
                        if (e.target.value === "") {
                          handleItemChange(index, "qty_shell", "0");
                        }
                      }}
                      onChange={(e) => handleItemChange(index, "qty_shell", e.target.value)}
                      className="w-full p-2 text-center bg-gray-100 border border-gray-200 rounded"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <input 
                      type="text" 
                      value={item.qty_pcs} 
                      readOnly 
                      className="w-full p-2 text-center bg-gray-100 border border-gray-200 rounded" 
                    />
                  </td>
                  <td className="py-2 px-4">
                    <div className="relative">
                      <input
                        type="text"
                        value={`₱${formatDecimal(item.line_total).toFixed(2)}`}
                        readOnly
                        className="w-full p-2 text-center bg-gray-100 border border-gray-200 rounded"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="flex justify-end gap-4 mt-6">
          <button
            type="button"
            onClick={() => navigate("/supplier-returns")}
            className="px-6 py-3 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-3 bg-gray-900 text-white rounded hover:bg-gray-800"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

export default SupplierReturnForm;