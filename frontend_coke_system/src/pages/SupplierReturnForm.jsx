import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const SupplierReturnForm = () => {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);

  // ✅ Returns local date & time in YYYY-MM-DDTHH:MM format
  const getLocalDateTime = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - offset).toISOString().slice(0, 16);
    return localISOTime;
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

  // Store the original returnable stock entries for removal
  const [originalReturnableStocks, setOriginalReturnableStocks] = useState([]);
  // NEW: Store merchandising items that need to be cleared
  const [merchandisingItemsToClean, setMerchandisingItemsToClean] = useState([]);

  // Fixed useEffect to remove the dependency warning
  useEffect(() => {
    // Fetch all data in parallel
    Promise.all([
      axios.get("http://localhost:8080/api/suppliers/"),
      axios.get("http://localhost:8080/api/pricing/"),
      axios.get("http://localhost:8080/api/products/")
    ])
    .then(([suppliersRes, pricingRes, productsRes]) => {
      // Set suppliers
      setSuppliers(suppliersRes.data);
      
      // Get pricing data
      const pricing = pricingRes.data;
      console.log("Pricing data loaded:", pricing);
      
      // Filter content products
      const contentProducts = productsRes.data.filter(
        p => p.product_category?.name === "Content"
      );
      
      console.log("Content products:", contentProducts);
      setProducts(contentProducts);
    })
    .catch(err => {
      console.error("Error fetching data:", err);
    });
  }, []);

  // Function to fetch return empties for selected supplier FROM RETURNABLE STOCKS
  const fetchReturnEmpties = async (supplierId) => {
    try {
      console.log("🔍 Fetching returnable stocks for supplier:", supplierId);
      
      // Get returnable stocks data to find return empties
      const response = await axios.get(`http://localhost:8080/api/returnable-stocks/`);
      console.log("📦 All returnable stocks data:", response.data);
      
      // Filter by supplier_id to get empties for the selected supplier
      const filteredData = response.data.filter(item => {
        console.log("🔍 Checking item:", item, "Supplier match:", 
          String(item.supplier_id) === String(supplierId), 
          "Alternative supplier match:", String(item.supplier) === String(supplierId)
        );
        
        return String(item.supplier_id) === String(supplierId) || String(item.supplier) === String(supplierId);
      });
      
      console.log("✅ Filtered returnable stocks for supplier ID:", supplierId, filteredData);
      
      // Store the original data for removal later
      setOriginalReturnableStocks(filteredData);

      // NEW: Also find corresponding merchandising items that need to be cleared
      await findMerchandisingItemsToClean(supplierId);
      
      return filteredData;
    } catch (err) {
      console.error("❌ Error fetching returnable stocks for supplier:", supplierId, err);
      return [];
    }
  };

  // NEW: Function to find merchandising items that need to be cleaned
  const findMerchandisingItemsToClean = async (supplierId) => {
    try {
      console.log("🔍 Finding merchandising items to clean for supplier:", supplierId);
      
      const merchandisingResponse = await axios.get("http://localhost:8080/api/merchandisings/");
      const merchandisingData = merchandisingResponse.data;
      
      const itemsToClean = [];
      
      merchandisingData.forEach(merchandising => {
        if (merchandising.status === "Complete" && merchandising.items) {
          merchandising.items.forEach(item => {
            const emptyShell = item.empty_return_shell || 0;
            const emptyPcs = item.empty_return_pcs || 0;
            
            if (emptyShell > 0 || emptyPcs > 0) {
              // Find the product to get supplier info
              const product = products.find(p => p.id === item.product);
              
              if (product && String(product.supplier) === String(supplierId)) {
                itemsToClean.push({
                  merchandising_id: merchandising.id,
                  item_id: item.id,
                  product_id: item.product,
                  supplier_id: supplierId,
                  empty_shell_qty: emptyShell,
                  empty_bottle_qty: emptyPcs,
                  msp_no: merchandising.msp_no
                });
              }
            }
          });
        }
      });
      
      console.log("📋 Merchandising items to clean:", itemsToClean);
      setMerchandisingItemsToClean(itemsToClean);
      
    } catch (err) {
      console.error("❌ Error finding merchandising items to clean:", err);
    }
  };

  // Helper function to format a number to 2 decimal places and convert to a number
  const formatDecimal = (value) => {
    return Number(parseFloat(value || 0).toFixed(2));
  };

  // Function to populate table with return empties data - combine duplicate products
  const populateTableWithReturnEmpties = (returnEmptiesData) => {
    if (!returnEmptiesData || returnEmptiesData.length === 0) {
      console.log("No return empties found for this supplier");
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
      setOriginalReturnableStocks([]);
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
        const price = product.price || {};
        const bottlePrice = formatDecimal(price.bottle_price);
        const shellPrice = formatDecimal(price.shell_price);
        
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
  };

  // Handle supplier change
  const handleSupplierChange = async (supplierId) => {
    console.log("🔄 Supplier changed to:", supplierId);
    setForm(prev => ({ ...prev, supplier: supplierId }));
    
    if (supplierId) {
      console.log("🔍 Fetching return empties for supplier:", supplierId);
      // Fetch and populate return empties for the selected supplier
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
      setOriginalReturnableStocks([]);
      setMerchandisingItemsToClean([]);
    }
  };

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

  // NEW: Function to clear merchandising items empty returns
  const clearMerchandisingEmptyReturns = async () => {
    try {
      console.log("🧹 Clearing merchandising empty returns...");
      console.log("📋 Items to clean:", merchandisingItemsToClean);
      
      let clearedCount = 0;
      let errorCount = 0;
      
      for (const item of merchandisingItemsToClean) {
        try {
          console.log(`🔄 Clearing merchandising item ${item.item_id}`);
          
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

  // 🔥 IMPROVED: Function to remove returned empties from returnable-stocks
  const removeReturnedEmptiesFromReturnableStocks = async (returnedItems) => {
    try {
      console.log("🧹 Starting removal process from returnable-stocks");
      console.log("📦 Original returnable stocks to process:", originalReturnableStocks);
      console.log("📋 Returned items:", returnedItems);

      let removedCount = 0;
      let updatedCount = 0;
      let errorCount = 0;

      for (const returnedItem of returnedItems) {
        console.log(`\n🔄 Processing returned item: ${returnedItem.product} (${returnedItem.qty_shell} shells, ${returnedItem.qty_pcs} pcs)`);
        
        let remainingShellQty = returnedItem.qty_shell;
        let remainingPcsQty = returnedItem.qty_pcs;

        // Find matching returnable stock entries for this product
        const matchingStocks = originalReturnableStocks.filter(stock => {
          const productMatch = stock.product_id === returnedItem.product || stock.product === returnedItem.product;
          const supplierMatch = String(stock.supplier_id) === String(form.supplier) || String(stock.supplier) === String(form.supplier);
          console.log(`🔍 Checking stock ${stock.id}: Product match: ${productMatch}, Supplier match: ${supplierMatch}`);
          return productMatch && supplierMatch;
        });

        console.log(`📦 Found ${matchingStocks.length} matching stock entries`);

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
                console.log(`🗑️ Deleting stock entry ${stock.id} (no remaining quantities)`);
                await axios.delete(`http://localhost:8080/api/returnable-stocks/${stock.id}/`);
                removedCount++;
                console.log(`✅ Successfully deleted stock entry ${stock.id}`);
              } else {
                // Update with new quantities
                console.log(`🔄 Updating stock entry ${stock.id}`);
                const updateData = {
                  empty_shell_qty: newShells,
                  empty_bottle_qty: newPcs,
                  last_updated: new Date().toISOString()
                };
                
                console.log("📤 Sending update data:", updateData);
                const response = await axios.patch(`http://localhost:8080/api/returnable-stocks/${stock.id}/`, updateData);
                console.log("📥 Update response:", response.data);
                updatedCount++;
                console.log(`✅ Successfully updated stock entry ${stock.id}`);
              }

              // Update remaining quantities
              remainingShellQty -= shellsToSubtract;
              remainingPcsQty -= pcsToSubtract;

            } catch (error) {
              console.error(`❌ Failed to process stock entry ${stock.id}:`, error);
              console.error("Error details:", error.response?.data);
              errorCount++;
            }
          }
        }

        if (remainingShellQty > 0 || remainingPcsQty > 0) {
          console.warn(`⚠️ Could not process all quantities for product ${returnedItem.product}. Remaining: ${remainingShellQty} shells, ${remainingPcsQty} pcs`);
        }
      }

      console.log(`\n🏁 Removal process completed:`);
      console.log(`🗑️ Deleted entries: ${removedCount}`);
      console.log(`🔄 Updated entries: ${updatedCount}`);
      console.log(`❌ Errors: ${errorCount}`);

      return { removed: removedCount, updated: updatedCount, errors: errorCount };

    } catch (error) {
      console.error("❌ Critical error in removal process:", error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

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
      
      // Save the supplier return form with the returned items info
      const response = await axios.post("http://localhost:8080/api/supplier-return-form/", {
        sup_no: form.sup_no,
        supplier: form.supplier,
        date: form.date,
        total_amount: totalAmount,
        items: filteredItems,
        auto_remove_empties: true
      });
      
      console.log("✅ Supplier return saved successfully:", response.data);

      // STEP 1: Clear merchandising empty returns (this fixes the Return Empties view!)
      console.log("🧹 Step 1: Clearing merchandising empty returns...");
      const merchandisingResult = await clearMerchandisingEmptyReturns();

      // STEP 2: Remove the returned empties from returnable-stocks database
      console.log("🧹 Step 2: Cleaning up returnable stocks...");
      const cleanupResult = await removeReturnedEmptiesFromReturnableStocks(filteredItems);
      
      let message = "Supplier return saved successfully!";
      
      if (merchandisingResult.cleared > 0) {
        message += ` ${merchandisingResult.cleared} merchandising empty returns have been cleared.`;
      }
      
      if (cleanupResult.removed > 0) {
        message += ` ${cleanupResult.removed} returnable stock entries have been completely removed.`;
      }
      
      if (cleanupResult.updated > 0) {
        message += ` ${cleanupResult.updated} returnable stock entries have been updated with remaining quantities.`;
      }
      
      const totalErrors = (merchandisingResult.errors || 0) + (cleanupResult.errors || 0);
      if (totalErrors > 0) {
        message += ` Note: ${totalErrors} items had errors during cleanup.`;
      }
      
      message += " The Return Empties view will be updated automatically.";
      
      alert(message);
      navigate("/supplier-returns");
      
    } catch (err) {
      console.error("❌ Save error:", err);
      console.log("Error details:", err.response?.data);
      alert("Failed to save supplier return.");
    }
  };

  return (
    <div className="bg-white p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <h2 className="text-xl font-bold mb-6">Supplier Return Form</h2>
        
        {(originalReturnableStocks.length > 0 || merchandisingItemsToClean.length > 0) && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-blue-800 text-sm">
              <strong>🔄 Processing data cleanup:</strong>
              <br />
              {originalReturnableStocks.length > 0 && `• ${originalReturnableStocks.length} returnable stock entries`}
              <br />
              {merchandisingItemsToClean.length > 0 && `• ${merchandisingItemsToClean.length} merchandising empty return entries`}
              <br />
              When saved, these entries will be automatically removed/updated in the database.
            </p>
          </div>
        )}
        
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