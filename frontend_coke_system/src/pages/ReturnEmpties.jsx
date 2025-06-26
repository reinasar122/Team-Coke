import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";

const ReturnEmpties = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [returnedEmpties, setReturnedEmpties] = useState([]);
  const [filteredEmpties, setFilteredEmpties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSuppliers = useCallback(async () => {
    try {
      const response = await axios.get("http://localhost:8080/api/suppliers/");
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
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await axios.get("http://localhost:8080/api/products/");
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
  }, []);

  const fetchReturnedEmptiesFromMerchandising = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get("http://localhost:8080/api/merchandisings/");
      console.log("Raw merchandising response:", response.data);
      
      let merchandisingData = response.data;
      if (merchandisingData.results) merchandisingData = merchandisingData.results;
      if (merchandisingData.data) merchandisingData = merchandisingData.data;
      
      const emptyReturns = [];
      
      if (Array.isArray(merchandisingData)) {
        merchandisingData.forEach(merchandising => {
          console.log("Processing merchandising item:", merchandising);
          
          if (merchandising.status === "Complete" && merchandising.items) {
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
                  productName = product.product_name;
                  supplierId = product.supplier; // This is the supplier ID
                  console.log("Found product:", productName, "Supplier ID:", supplierId);
                  
                  // Find the supplier in the suppliers array
                  const supplier = suppliers.find(s => s.id === supplierId);
                  if (supplier) {
                    supplierName = supplier.company_name;
                    console.log("Found supplier:", supplierName);
                  }
                }
                
                // Final fallback values
                if (!productName) {
                  productName = `Unknown Product (ID: ${productId || 'undefined'})`;
                }
                
                if (!supplierName) {
                  supplierName = `Unknown Supplier (ID: ${supplierId || 'undefined'})`;
                }

                console.log("Final Names - Product:", productName, "Supplier:", supplierName);

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
                  item_id: item.id
                });
              }
            });
          }
        });
      }
      
      console.log("Processed empty returns:", emptyReturns);
      setReturnedEmpties(emptyReturns);
      setError(null);
    } catch (error) {
      console.error("Error fetching merchandising returns:", error);
      setError("Failed to load merchandising data");
      setReturnedEmpties([]);
    }
    setLoading(false);
  }, [products, suppliers]);

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
  }, [fetchSuppliers, fetchProducts]);

  useEffect(() => {
    if (suppliers.length > 0 && products.length > 0) {
      fetchReturnedEmptiesFromMerchandising();
    }
  }, [suppliers, products, fetchReturnedEmptiesFromMerchandising]);

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

  const handleReturnStock = async () => {
    if (filteredEmpties.length === 0) {
      alert("No items to return.");
      return;
    }

    const confirmed = window.confirm("Are you sure you want to return these empties to stock?");
    if (!confirmed) return;

    try {
      const payload = {
        return_date: new Date().toISOString(),
        items: filteredEmpties.map(item => ({
          merchandising_id: item.merchandising_id,
          item_id: item.item_id,
          product_id: item.product_id,
          supplier_id: item.supplier_id,
          product_name: item.product_name,
          empty_return_shell: item.empty_return_shell,
          empty_return_pcs: item.empty_return_pcs
        }))
      };

      console.log("Sending payload:", payload);
      await axios.post("http://localhost:8080/api/process-empties-return/", payload);
      alert("Empties returned to stock successfully!");
      fetchReturnedEmptiesFromMerchandising();
    } catch (error) {
      console.error("Error returning empties:", error);
      alert("Failed to return empties to stock: " + (error.response?.data?.message || error.message));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-6 flex items-center justify-center">
        <div className="text-gray-600">Loading returned empties...</div>
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
          
          <button
            onClick={handleReturnStock}
            className="ml-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
            disabled={filteredEmpties.length === 0}
          >
            RETURN STOCK
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-gray-700 font-medium border-b">MSP No.</th>
              <th className="px-4 py-3 text-left text-gray-700 font-medium border-b">Product</th>
              <th className="px-4 py-3 text-center text-gray-700 font-medium border-b">Empty Returns</th>
              <th className="px-4 py-3 text-left text-gray-700 font-medium border-b">Supplier</th>
              <th className="px-4 py-3 text-center text-gray-700 font-medium border-b">Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmpties.length > 0 ? (
              filteredEmpties.map((item, index) => (
                <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-4 py-3 border-b text-gray-800 font-medium">{item.msp_no}</td>
                  <td className="px-4 py-3 border-b text-gray-800">{item.product_name}</td>
                  <td className="px-4 py-3 border-b text-center text-gray-800">
                    <div>{item.empty_return_shell} Shell</div>
                    <div className="text-sm text-gray-600">{item.empty_return_pcs} PCs</div>
                  </td>
                  <td className="px-4 py-3 border-b text-gray-800">{item.supplier_name}</td>
                  <td className="px-4 py-3 border-b text-center text-gray-800">{item.date}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                  No returned empties available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredEmpties.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium">Total Transactions: </span>
              {filteredEmpties.length}
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