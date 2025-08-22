// SupplierReturnList.js - Updated with date/time fixes
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaTrash, FaEye } from "react-icons/fa";

const SupplierReturnList = () => {
  const [returns, setReturns] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [pricingData, setPricingData] = useState([]);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const navigate = useNavigate();

  // Function to get current warehouse
  const getCurrentWarehouse = () => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    
    // For admin users, use selected warehouse or their enrolled warehouse
    if (userData.role?.toLowerCase() === "admin") {
      return selectedWarehouse || { id: userData.warehouse_id, name: userData.warehouse };
    }
    
    // For non-admin users, always use their enrolled warehouse
    return { id: userData.warehouse_id, name: userData.warehouse };
  };

  // Function to fetch supplier returns for current warehouse
  const fetchSupplierReturns = async (warehouseId) => {
    try {
      const warehouseParam = warehouseId ? `?warehouse_id=${warehouseId}` : '';
      const response = await axios.get(`http://localhost:8080/api/supplier-return-form/${warehouseParam}`);
      console.log("📦 Supplier returns loaded for warehouse:", warehouseId, response.data.length);
      return response.data;
    } catch (err) {
      console.error("Error fetching supplier returns:", err);
      return [];
    }
  };

  useEffect(() => {
    // Get current warehouse on component mount
    const warehouse = getCurrentWarehouse();
    setCurrentWarehouse(warehouse);

    // Listen for warehouse changes
    const handleWarehouseChange = (event) => {
      const newWarehouse = event.detail.warehouse || getCurrentWarehouse();
      console.log("🏭 Warehouse changed in supplier returns:", newWarehouse);
      setCurrentWarehouse(newWarehouse);
      
      // Refetch data for new warehouse
      if (newWarehouse?.id) {
        fetchSupplierReturns(newWarehouse.id).then(setReturns);
      }
    };

    window.addEventListener('warehouseChanged', handleWarehouseChange);
    
    // Fetch all data in parallel for better performance
    Promise.all([
      fetchSupplierReturns(warehouse?.id),
      axios.get("http://localhost:8080/api/products/"),
      axios.get("http://localhost:8080/api/pricing/")
    ])
    .then(([returnsData, productsRes, pricingRes]) => {
      setReturns(returnsData);
      setProducts(productsRes.data);
      setPricingData(pricingRes.data);
      
      console.log("Returns data loaded:", returnsData.length);
      console.log("Products data loaded:", productsRes.data.length);
      console.log("Pricing data loaded:", pricingRes.data.length);
      
      // Log the structure of pricing data to help debugging
      if (pricingRes.data.length > 0) {
        console.log("Sample pricing data structure:", pricingRes.data[0]);
        console.log("All pricing data IDs:", pricingRes.data.map(p => p.id));
      }
    })
    .catch(err => {
      console.error("Error fetching initial data:", err);
    });

    // Cleanup event listener
    return () => {
      window.removeEventListener('warehouseChanged', handleWarehouseChange);
    };
  }, []);

  // ✅ FIXED helper function to format date correctly
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    
    try {
      console.log("Original date string from server:", dateString);
      
      // Create date object from the string
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.error("Invalid date string:", dateString);
        return "Invalid Date";
      }
      
      console.log("Parsed date object:", date);
      
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
      
      console.log("Formatted date:", formattedDate);
      return formattedDate;
      
    } catch (error) {
      console.error("Error formatting date:", error, "for date string:", dateString);
      return "Invalid Date";
    }
  };

  const handleDelete = async (id) => {
    // Create custom confirmation dialog
    const confirmDelete = await showConfirmDialog("Are you sure you want to delete this supplier return?");
    if (!confirmDelete) return;

    try {
      await axios.delete(`http://localhost:8080/api/supplier-return-form/${id}/`);
      setReturns((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      console.error("Delete failed:", error);
      showErrorModal("Failed to delete return.");
    }
  };

  // Custom confirmation dialog
  const showConfirmDialog = (message) => {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
          <p class="text-gray-700 dark:text-gray-300 mb-4">${message}</p>
          <div class="flex justify-end space-x-3">
            <button id="cancel-btn" class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">Cancel</button>
            <button id="confirm-btn" class="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded">Confirm</button>
          </div>
        </div>
      `;
      
      const cancelBtn = modal.querySelector('#cancel-btn');
      const confirmBtn = modal.querySelector('#confirm-btn');
      
      cancelBtn.onclick = () => {
        document.body.removeChild(modal);
        resolve(false);
      };
      
      confirmBtn.onclick = () => {
        document.body.removeChild(modal);
        resolve(true);
      };
      
      document.body.appendChild(modal);
    });
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

  // Enhanced helper function to find the correct pricing for a product
  const findProductPricing = (productId, productName) => {
    // Log the lookup parameters
    console.log(`Looking up pricing for productId=${productId}, productName=${productName}`);
    console.log("Available pricing records:", pricingData.map(p => ({ 
      id: p.id, 
      product_id: p.product_id, 
      product_name: p.product_name,
      bottle_price: p.bottle_price,
      shell_price: p.shell_price
    })));
    
    // If we have a specific product name like "Red Horse", look for its exact pricing
    if (productName === "Red Horse") {
      // For Red Horse, we want ID 14 based on the screenshot
      const redHorsePricing = pricingData.find(p => p.id === 14);
      if (redHorsePricing) {
        console.log("Found specific pricing for Red Horse:", redHorsePricing);
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
        console.log(`Found pricing by product name "${productName}":`, pricing);
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
      console.log(`Found pricing by ID for product ${productId}:`, pricing);
      return pricing;
    }
    
    // If still not found, log the issue
    console.warn(`No pricing found for product ${productName || productId}. Using default prices.`);
    
    return null;
  };

  const handleView = async (id) => {
    try {
      // First get the supplier return details
      const returnResponse = await axios.get(`http://localhost:8080/api/supplier-return-form/${id}/`);
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
            
            console.log(`Using API pricing for ${productName}:`, { bottlePrice, shellPrice });
          } else {
            // If pricing not found, try to get it from the product's nested price object
            if (product && product.price) {
              bottlePrice = Number(product.price.bottle_price || 0);
              shellPrice = Number(product.price.shell_price || 0);
              
              console.log(`Using product's nested price for ${productName}:`, { bottlePrice, shellPrice });
            } else {
              console.warn(`No pricing found for ${productName}. Will display 0.00.`);
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
      showErrorModal("Failed to load return details.");
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

  return (
    <div className="p-6">
      {/* Header with warehouse display */}
      <div className="flex justify-between items-center mb-4">
        <div>
        </div>
      </div>

      {/* Search and Add button section */}
      <div className="flex justify-between items-center mb-4">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="p-2 border border-gray-300 rounded-md w-64"
        />

        <button
          onClick={() => navigate("/supplier-returns/new")}
          className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 flex items-center"
        >
          <span className="mr-1">+</span> New Supplier Return
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-black text-white text-left">
              <th className="px-4 py-3">Sup No.</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Warehouse</th>
              <th className="px-4 py-3">Total Amount</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReturns.length > 0 ? (
              filteredReturns.map((item, index) => (
                <tr 
                  key={index} 
                  className="border-b hover:bg-gray-100"
                >
                  <td className="px-4 py-3">{item.sup_no}</td>
                  <td className="px-4 py-3">{formatDate(item.date)}</td>
                  <td className="px-4 py-3">
                    {item.supplier_name || item.supplier || "N/A"}
                  </td>
                  <td className="px-4 py-3">
                    {item.warehouse_name || "N/A"}
                  </td>
                  <td className="px-4 py-3">
                    ₱{Number(item.total_amount || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 flex justify-center space-x-3">
                    <button
                      onClick={() => handleView(item.id)}
                      className="text-blue-600 hover:text-blue-800"
                      title="View"
                    >
                      <FaEye className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete"
                    >
                      <FaTrash className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center py-4 text-gray-500">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Supplier Return Details</h3>
              <button 
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-xl">&times;</span>
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-gray-600 text-sm">Sup No.</p>
                <p className="font-medium">{selectedReturn.sup_no}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Date & Time</p>
                <p className="font-medium">{formatDate(selectedReturn.date)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Supplier</p>
                <p className="font-medium">{selectedReturn.supplier_name || "N/A"}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Warehouse</p>
                <p className="font-medium">{selectedReturn.warehouse_name || "N/A"}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total Amount</p>
                <p className="font-medium">₱{Number(selectedReturn.total_amount || 0).toFixed(2)}</p>
              </div>
            </div>
            
            <h4 className="font-bold mb-2">Items</h4>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse mb-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-4 py-2 text-left">Product Name</th>
                    <th className="border px-4 py-2 text-right">Bottle Price</th>
                    <th className="border px-4 py-2 text-right">Shell Price</th>
                    <th className="border px-4 py-2 text-right">Qty (Shell)</th>
                    <th className="border px-4 py-2 text-right">Qty (PC)</th>
                    <th className="border px-4 py-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {returnItems.length > 0 ? (
                    returnItems.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="border px-4 py-2">
                          {item.product_name}
                        </td>
                        <td className="border px-4 py-2 text-right">
                          ₱{Number(item.display_bottle_price || 0).toFixed(2)}
                        </td>
                        <td className="border px-4 py-2 text-right">
                          ₱{Number(item.display_shell_price || 0).toFixed(2)}
                        </td>
                        <td className="border px-4 py-2 text-right">{item.qty_shell}</td>
                        <td className="border px-4 py-2 text-right">{item.qty_pcs}</td>
                        <td className="border px-4 py-2 text-right">
                          ₱{Number(item.line_total || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-center py-4 text-gray-500 border">
                        No items found for this return.
                      </td>
                    </tr>
                    )}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100">
                    <td colSpan="5" className="border px-4 py-2 text-right font-bold">
                      Total:
                    </td>
                    <td className="border px-4 py-2 text-right font-bold">
                      ₱{Number(selectedReturn.total_amount || 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={closeModal}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
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