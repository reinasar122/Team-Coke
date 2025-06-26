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
      
      // We don't need to process products here since the pricing is already 
      // included as a nested 'price' object in each product
      console.log("Content products:", contentProducts);
      setProducts(contentProducts);
    })
    .catch(err => {
      console.error("Error fetching data:", err);
    });
  }, []); // No dependencies needed now

  // Helper function to format a number to 2 decimal places and convert to a number
  const formatDecimal = (value) => {
    // First convert to float, then format to 2 decimal places, then convert back to number
    return Number(parseFloat(value || 0).toFixed(2));
  };

  const handleItemChange = (index, field, value) => {
    // Create a deep copy of the items array
    const updatedItems = [...form.items];
    updatedItems[index] = { ...updatedItems[index] };
    
    // Update the field
    updatedItems[index][field] = value;

    if (field === "product_name" && value === "") {
      // Reset row if product is cleared
      updatedItems[index] = {
        ...updatedItems[index],
        product: "",
        content_no: 0,
        bottle_price: 0,
        shell_price: 0,
        qty_shell: "0",
        qty_pcs: "0",
        line_total: 0,
        product_name: ""
      };
    } else {
      // If product changed, update all product-related values
      if (field === "product_name" && value !== "") {
        const selectedProduct = products.find(p => p.product_name === value);
        
        if (selectedProduct) {
          console.log("Selected product with price:", selectedProduct);
          const contentNo = selectedProduct.unit_type?.content_no || 0;
          
          // FIXED: Get pricing from the nested price object
          const price = selectedProduct.price || {};
          const bottlePrice = formatDecimal(price.bottle_price);
          const shellPrice = formatDecimal(price.shell_price);
          
          console.log("Extracted prices:", { bottlePrice, shellPrice });
          
          updatedItems[index] = {
            ...updatedItems[index],
            product: selectedProduct.id,
            product_name: selectedProduct.product_name,
            content_no: contentNo,
            bottle_price: bottlePrice,
            shell_price: shellPrice,
            qty_shell: updatedItems[index].qty_shell
          };
        }
      }
    }
    
    // Recalculate all item values after any change
    for (let i = 0; i < updatedItems.length; i++) {
      const item = updatedItems[i];
      
      if (item.product) {
        const contentNo = Number(item.content_no) || 0;
        const bottlePrice = formatDecimal(item.bottle_price);
        const shellPrice = formatDecimal(item.shell_price);
        
        // Convert qty_shell to a number, default to 0 if NaN
        const qtyShell = parseInt(item.qty_shell, 10) || 0;
        
        // Calculate pieces based on content_no
        const qtyPcs = qtyShell * contentNo;
        
        // Calculate line total using precise decimal math
        const bottleTotal = qtyPcs * bottlePrice;
        const shellTotal = qtyShell * shellPrice;
        const lineTotal = formatDecimal(bottleTotal + shellTotal);
        
        // Log the calculation details
        console.log(`Row ${i} calculation:`, {
          product: item.product_name,
          contentNo,
          bottlePrice,
          shellPrice,
          qtyShell,
          qtyPcs,
          bottleTotal: bottleTotal.toFixed(2),
          shellTotal: shellTotal.toFixed(2),
          lineTotal: lineTotal.toFixed(2)
        });
        
        // Update the item with the new calculated values
        updatedItems[i] = {
          ...item,
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
    
    console.log("All line totals:", updatedItems.map(item => ({
      product: item.product_name,
      lineTotal: formatDecimal(item.line_total).toFixed(2)
    })));
    console.log("Total amount:", totalAmount.toFixed(2));

    // Update form with new items and total
    setForm(prev => ({
      ...prev,
      items: updatedItems,
      total_amount: totalAmount
    }));
  };

  const addRowIfNeeded = () => {
    const last = form.items[form.items.length - 1];
    if (last.product_name || last.qty_shell !== "0") {
      setForm({
        ...form,
        items: [...form.items, {
          product: "",
          product_name: "",
          content_no: 0,
          bottle_price: 0,
          shell_price: 0,
          qty_shell: "0",
          qty_pcs: "0",
          line_total: 0,
        }]
      });
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
      const response = await axios.post("http://localhost:8080/api/supplier-return-form/", {
        sup_no: form.sup_no,
        supplier: form.supplier,
        date: form.date,
        total_amount: totalAmount,
        items: filteredItems,
      });
      
      console.log("Server response:", response.data);
      alert("Supplier return saved!");
      navigate("/supplier-returns");
    } catch (err) {
      console.error("Save error:", err);
      console.log("Error details:", err.response?.data);
      alert("Failed to save supplier return.");
    }
  };

  return (
    <div className="bg-white p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <h2 className="text-xl font-bold mb-6">Supplier Return Form</h2>
        
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
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
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
                    <select
                      value={item.product_name}
                      onChange={(e) => handleItemChange(index, "product_name", e.target.value)}
                      onBlur={addRowIfNeeded}
                      className="w-full p-2 bg-gray-100 border border-gray-200 rounded"
                    >
                      <option value="">Select product</option>
                      {products.map(p => (
                        <option key={p.id} value={p.product_name}>
                          {p.product_name}
                        </option>
                      ))}
                    </select>
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
            {/* Keep the footer in the table for total amount at the bottom */}
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