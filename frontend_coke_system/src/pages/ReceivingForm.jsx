import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const ReceivingForm = () => {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [receiveNo, setReceiveNo] = useState("");
  const [supplierReturns, setSupplierReturns] = useState([]);
  const [isLoadingReturns, setIsLoadingReturns] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    supplier: "",
    invoice_no: "",
    return_total_amount: 0,
    net_amount: 0,
    received_by: "",
    remarks: "",
    details: [
      {
        product_id: "",
        pcs_qty: 0,
        shell_qty: 0,
        bottle_qty: 0,
        bad_order_pcs: 0,
        unit_cost: 0,
        total: 0,
      },
    ],
  });

  useEffect(() => {
    axios.get("http://localhost:8080/api/suppliers/").then((res) => setSuppliers(res.data));
    axios.get("http://localhost:8080/api/products/").then((res) => setProducts(res.data));
    axios.get("http://localhost:8080/api/users/").then((res) => setUsers(res.data));

    const generateJumbledCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      return `RCV-${Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')}`;
    };

    setReceiveNo(generateJumbledCode());
  }, []);

  // Filter products when supplier changes
  useEffect(() => {
    if (form.supplier && products.length > 0) {
      const supplierProducts = products.filter(product => 
        String(product.supplier_id) === String(form.supplier) || 
        String(product.supplier) === String(form.supplier)
      );
      setFilteredProducts(supplierProducts);
      
      // Clear existing product selections when supplier changes
      setForm(prev => ({
        ...prev,
        details: [
          {
            product_id: "",
            pcs_qty: 0,
            shell_qty: 0,
            bottle_qty: 0,
            bad_order_pcs: 0,
            unit_cost: 0,
            total: 0,
          }
        ]
      }));
    } else {
      setFilteredProducts([]);
    }
  }, [form.supplier, products]);

  // Function to update form with return amount calculation
  const updateFormWithReturnAmount = useCallback((returnAmount) => {
    const total = form.details.reduce((sum, row) => sum + parseFloat(row.total || 0), 0);
    const netAmount = Math.max(0, total - returnAmount);
    
    setForm(prev => ({
      ...prev,
      return_total_amount: returnAmount,
      net_amount: netAmount.toFixed(2)
    }));
  }, [form.details]);

  // Fetch supplier returns from API
  const fetchSupplierReturns = useCallback(async (supplierId) => {
    setIsLoadingReturns(true);
    setError("");
    
    try {
      console.log("Fetching returns for supplier:", supplierId);
      
      // Get all supplier returns
      const response = await axios.get("http://localhost:8080/api/supplier-return-form/");
      console.log("All supplier returns:", response.data);
      
      // Filter returns for the selected supplier (handle both string and number comparison)
      const filteredReturns = response.data.filter(returnItem => 
        String(returnItem.supplier) === String(supplierId)
      );
      
      console.log("Filtered returns for supplier", supplierId, ":", filteredReturns);
      
      if (filteredReturns.length > 0) {
        setSupplierReturns(filteredReturns);
        
        // Calculate total amount from all returns for this supplier
        const totalReturnAmount = filteredReturns.reduce((sum, returnItem) => 
          sum + parseFloat(returnItem.total_amount || 0), 0);
        
        console.log("Total return amount calculated:", totalReturnAmount);
        updateFormWithReturnAmount(totalReturnAmount);
      } else {
        setSupplierReturns([]);
        updateFormWithReturnAmount(0);
      }
    } catch (error) {
      console.error("Error fetching supplier returns:", error);
      console.error("Error details:", error.response?.data || error.message);
      setSupplierReturns([]);
      updateFormWithReturnAmount(0);
      setError("Failed to fetch supplier return data. Please try again.");
    } finally {
      setIsLoadingReturns(false);
    }
  }, [updateFormWithReturnAmount]);

  // Fetch supplier return items whenever supplier changes
  useEffect(() => {
    if (form.supplier) {
      fetchSupplierReturns(form.supplier);
    } else {
      setSupplierReturns([]);
      updateFormWithReturnAmount(0);
    }
  }, [form.supplier, fetchSupplierReturns, updateFormWithReturnAmount]);

  // Function to remove supplier returns after receiving is processed
  const removeProcessedSupplierReturns = async (supplierId) => {
    try {
      console.log("🧹 Removing processed supplier returns for supplier:", supplierId);
      
      // Get all supplier returns for this supplier
      const response = await axios.get("http://localhost:8080/api/supplier-return-form/");
      const supplierReturns = response.data.filter(returnItem => 
        String(returnItem.supplier) === String(supplierId)
      );
      
      console.log("📋 Found supplier returns to process:", supplierReturns);
      
      // Track deletions
      let deletedCount = 0;
      
      // Remove ALL supplier returns for this supplier since the receiving processes them
      for (const returnItem of supplierReturns) {
        try {
          console.log(`🗑️ Removing processed supplier return: ${returnItem.sup_no} (ID: ${returnItem.id})`);
          await axios.delete(`http://localhost:8080/api/supplier-return-form/${returnItem.id}/`);
          console.log(`✅ Successfully removed return: ${returnItem.sup_no}`);
          deletedCount++;
        } catch (error) {
          console.error(`❌ Error removing return ${returnItem.id}:`, error);
          // Continue with other returns even if one fails
        }
      }
      
      console.log(`🏁 Finished removing processed supplier returns. Removed ${deletedCount} returns.`);
      
      // Return the count for user feedback
      return deletedCount;
    } catch (error) {
      console.error("❌ Error removing processed supplier returns:", error);
      // Don't throw error - this shouldn't prevent the main operation
      return 0;
    }
  };

  const handleSupplierChange = (supplierId) => {
    setForm(prev => ({
      ...prev,
      supplier: supplierId,
      details: [
        {
          product_id: "",
          pcs_qty: 0,
          shell_qty: 0,
          bottle_qty: 0,
          bad_order_pcs: 0,
          unit_cost: 0,
          total: 0,
        }
      ]
    }));
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...form.details];
    const row = newRows[index];

    row[field] = value === "" ? "" : Number(value);

    const product = filteredProducts.find((p) => p.id === Number(row.product_id));
    const content_no = product?.unit_type?.content_no || 1;

    const shell_qty = row.shell_qty === "" || isNaN(row.shell_qty) ? 0 : Number(row.shell_qty);
    const bad_order_pcs = row.bad_order_pcs === "" || isNaN(row.bad_order_pcs) ? 0 : Number(row.bad_order_pcs);

    const raw_pcs = shell_qty * content_no;
    const adjusted_pcs = Math.max(0, raw_pcs - bad_order_pcs);

    if (field === "shell_qty" || field === "bad_order_pcs") {
      row.pcs_qty = adjusted_pcs;
      row.bottle_qty = adjusted_pcs;
    }

    if (product?.price) {
      const { purchase_price = 0, shell_price = 0, bottle_price = 0 } = product.price;
      const unit_cost = purchase_price + bottle_price + (shell_price / content_no);
      row.unit_cost = unit_cost.toFixed(2);
      row.total = (adjusted_pcs * unit_cost).toFixed(2);
    }

    const total = newRows.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
    const returnAmount = parseFloat(form.return_total_amount) || 0;
    const net = Math.max(0, total - returnAmount);

    const isLastRow = index === newRows.length - 1;
    const rowFilled = row.product_id && row.shell_qty;

    if (isLastRow && rowFilled) {
      newRows.push({
        product_id: "",
        pcs_qty: 0,
        shell_qty: 0,
        bottle_qty: 0,
        bad_order_pcs: 0,
        unit_cost: 0,
        total: 0,
      });
    }

    setForm({ ...form, details: newRows, net_amount: net.toFixed(2) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const filteredRows = form.details.filter(row =>
      row.product_id && (row.shell_qty !== "" && row.shell_qty !== 0)
    );

    if (filteredRows.length === 0) {
      alert("Please add at least one product to the receiving form.");
      return;
    }

    if (!form.supplier) {
      alert("Please select a supplier.");
      return;
    }

    if (!form.received_by) {
      alert("Please select who received the items.");
      return;
    }

    const dataToSubmit = {
      ...form,
      receive_no: receiveNo,
      details: filteredRows,
    };

    try {
      // Save the receiving first
      console.log("💾 Saving receiving...");
      await axios.post("http://localhost:8080/api/receiving/", dataToSubmit);
      console.log("✅ Receiving saved successfully");
      
      // After successful save, remove ALL supplier returns for this supplier
      // since the receiving process handles the empty returns
      console.log("🧹 Starting removal of processed supplier returns...");
      const deletedCount = await removeProcessedSupplierReturns(form.supplier);
      
      // Provide appropriate feedback
      let message = "Receiving saved successfully!";
      if (deletedCount > 0) {
        message += ` ${deletedCount} supplier return(s) have been processed and removed.`;
      }
      
      alert(message);
      navigate("/receiving");
    } catch (error) {
      console.error("❌ Save failed:", error);
      alert("Save failed! " + (error.response?.data?.message || "See console for details."));
    }
  };

  const totalReceiving = form.details.reduce((sum, row) => sum + parseFloat(row.total || 0), 0);

  return (
    <form onSubmit={handleSubmit} className="max-w-[98%] mx-auto p-10 bg-white rounded-3xl shadow-lg space-y-10">
      
       {/* Remove spinner for all number fields */}
       <style>{`
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded mb-6">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-gray-600 font-semibold mb-2">Receiving No:</label>
          <input type="text" value={receiveNo} readOnly className="w-full p-3 rounded-lg bg-gray-100 text-gray-800 font-bold border border-gray-300" />
        </div>
        <div>
          <label className="block text-gray-600 font-semibold mb-2">Supplier:</label>
          <select 
            value={form.supplier} 
            onChange={(e) => handleSupplierChange(e.target.value)} 
            className="w-full p-3 rounded-lg bg-gray-100 border-gray-300"
          >
            <option value="">Select Supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.company_name}</option>
            ))}
          </select>
          {isLoadingReturns && (
            <p className="text-blue-600 text-sm mt-1">Loading supplier returns...</p>
          )}
          {form.supplier && filteredProducts.length > 0 && (
            <p className="text-green-600 text-sm mt-1">
              {filteredProducts.length} products available from this supplier
            </p>
          )}
          {form.supplier && filteredProducts.length === 0 && (
            <p className="text-orange-600 text-sm mt-1">
              No products found for this supplier
            </p>
          )}
        </div>
        <div>
          <label className="block text-gray-600 font-semibold mb-2">Invoice No:</label>
          <input type="text" value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border-gray-300" />
        </div>
      </div>

      {/* Financial Summary Section */}
      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Financial Summary</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="block text-gray-600 font-semibold mb-2">Total Receiving Amount:</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-500">₱</span>
              <input
                type="text"
                value={parseFloat(totalReceiving || 0).toFixed(2)}
                readOnly
                className="w-full pl-8 p-3 rounded-lg bg-gray-100 text-gray-800 font-semibold"
              />
            </div>
          </div>
          <div>
            <label className="block text-gray-600 font-semibold mb-2">
              Return Total Amount:
              {supplierReturns.length > 0 && (
                <span className="ml-2 text-sm text-blue-600">({supplierReturns.length} returns)</span>
              )}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-500">₱</span>
              <input
                type="text"
                value={parseFloat(form.return_total_amount || 0).toFixed(2)}
                readOnly
                className={`w-full pl-8 p-3 rounded-lg bg-gray-100 ${parseFloat(form.return_total_amount) > 0 ? 'text-red-600' : 'text-gray-800'} font-semibold`}
              />
            </div>
          </div>
          <div>
            <label className="block text-gray-600 font-semibold mb-2">Net Amount:</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-500">₱</span>
              <input
                type="text"
                value={parseFloat(form.net_amount || 0).toFixed(2)}
                readOnly
                className="w-full pl-8 p-3 rounded-lg bg-gray-100 text-gray-800 font-bold"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Return Details Section (shown only when returns exist) */}
      {supplierReturns.length > 0 && (
        <div className="bg-red-50 p-6 rounded-xl border border-red-200 shadow-sm">
          <h3 className="text-lg font-semibold text-red-700 mb-4">Supplier Return Details (Will be processed)</h3>
          <div className="overflow-x-auto mt-2">
            <table className="w-full rounded-xl border-collapse shadow-sm">
              <thead className="bg-red-700 text-white">
                <tr>
                  <th className="p-2">Return Reference</th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {supplierReturns.map((returnItem, index) => (
                  <tr key={index} className="hover:bg-red-50">
                    <td className="border-b p-2 text-center">
                      {returnItem.sup_no || "N/A"}
                    </td>
                    <td className="border-b p-2 text-center">
                      {returnItem.date ? 
                        new Date(returnItem.date).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="border-b p-2 text-right font-semibold text-red-600">
                      ₱{parseFloat(returnItem.total_amount || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-red-100">
                <tr>
                  <td colSpan="2" className="p-2 text-right font-bold">Total Return Amount:</td>
                  <td className="p-2 text-right font-bold text-red-600">
                    ₱{parseFloat(form.return_total_amount || 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-sm text-red-600 mt-2">
            ⚠️ Note: These supplier returns will be automatically removed when this receiving is saved, 
            as they represent empty returns that are being processed through this receiving.
          </p>
        </div>
      )}

      <div className="overflow-x-auto mt-8">
        <table className="w-full rounded-xl border-collapse shadow-md">
          <thead className="bg-[#0B1320] text-white">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Shell</th>
              <th className="p-3">PCS</th>
              <th className="p-3">BAD ORDERS  (PCs)</th>
              <th className="p-3">Unit Cost</th>
              <th className="p-3">Total</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {form.details.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="border-b p-2">
                  <select 
                    value={row.product_id || ""} 
                    onChange={(e) => handleRowChange(index, "product_id", e.target.value)} 
                    className="w-full p-2 rounded-lg bg-gray-100 border-gray-300"
                    disabled={!form.supplier}
                  >
                    <option value="">
                      {!form.supplier ? "Select Supplier First" : "Select Product"}
                    </option>
                    {filteredProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.product_name}</option>
                    ))}
                  </select>
                </td>
                <td className="border-b p-2">
                  <input
                    type="number"
                    disabled={!row.product_id}
                    value={row.shell_qty || 0}
                    onFocus={(e) => e.target.value === "0" ? e.target.value = "" : null}
                    onBlur={(e) => e.target.value === "" ? e.target.value = 0 : null}
                    onChange={(e) => handleRowChange(index, "shell_qty", e.target.value)}
                    className="w-full p-2 text-center rounded-lg bg-gray-100 border-gray-300 disabled:opacity-50"
                  />
                </td>
                <td className="border-b p-2">
                  <input 
                    type="number" 
                    value={row.pcs_qty || 0} 
                    readOnly 
                    disabled 
                    className="w-full p-2 text-center rounded-lg bg-gray-100 text-gray-700" 
                  />
                </td>
                <td className="border-b p-2">
                  <input
                    type="number"
                    disabled={!row.product_id}
                    value={row.bad_order_pcs || 0}
                    onFocus={(e) => e.target.value === "0" ? e.target.value = "" : null}
                    onBlur={(e) => e.target.value === "" ? e.target.value = 0 : null}
                    onChange={(e) => handleRowChange(index, "bad_order_pcs", e.target.value)}
                    className="w-full p-2 text-center rounded-lg bg-gray-100 border-gray-300 disabled:opacity-50"
                  />
                </td>
                <td className="border-b p-2 text-right text-gray-700">₱{parseFloat(row.unit_cost || 0).toFixed(2)}</td>
                <td className="border-b p-2 text-right font-bold text-gray-700">₱{parseFloat(row.total || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-10">
        <div>
          <label className="block text-gray-600 font-semibold mb-2">Received By:</label>
          <select value={form.received_by} onChange={(e) => setForm({ ...form, received_by: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border-gray-300">
            <option value="">Select user</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-gray-600 font-semibold mb-2">Remarks:</label>
          <textarea rows="3" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border-gray-300" />
        </div>
      </div>

      <div className="flex justify-end gap-4 mt-10">
        <button type="button" onClick={() => navigate("/receiving")} className="px-6 py-3 bg-[#fb2222] hover:bg-[#ff3e3e] text-white rounded-full transition">
          Cancel
        </button>
        <button type="submit" className="px-6 py-3 bg-[#0B1320] hover:bg-[#1C2230] text-white rounded-full font-semibold transition">
          Save
        </button>
      </div>
    </form>
  );
};

export default ReceivingForm;