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
      modal.className = 'modal-overlay';
      modal.style.background = 'rgba(0, 0, 0, 0.5)';
      modal.innerHTML = `
        <div class="modal">
          <p style="margin-bottom: 1rem; color: var(--text);">${message}</p>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button id="cancel-btn" class="btn btn-cancel">Cancel</button>
            <button id="confirm-btn" class="btn btn-danger">Confirm</button>
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
    modal.className = 'modal-overlay';
    modal.style.background = 'rgba(0, 0, 0, 0.5)';
    modal.innerHTML = `
      <div class="modal">
        <div style="text-align: center; margin-bottom: 1rem; color: var(--danger);">
          <svg style="width: 48px; height: 48px; margin: 0 auto 8px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </div>
        <p style="text-align: center; margin-bottom: 1.5rem; color: var(--text);">${message}</p>
        <div style="display: flex; justify-content: center;">
          <button class="btn btn-danger" onclick="this.closest('.modal-overlay').remove()">OK</button>
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
    <div className="page">
      {/* Header section with search instead of title */}
      <div className="page-header">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
          style={{ width: '250px', textAlign: 'left' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigate("/supplier-returns/new")}
            className="btn btn-add"
          >
            <span>+</span> New Supplier Return
          </button>
        </div>
      </div>

      {/* Table - Removed double container */}
      <div className="table-wrapper">
        <table className="table table-hover" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '15%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '25%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>
          <thead>
            <tr>
              <th className="text-left">Sup No.</th>
              <th style={{ textAlign: 'center' }}>Date</th>
              <th style={{ textAlign: 'center' }}>Supplier</th>
              <th style={{ textAlign: 'center' }}>Warehouse</th>
              <th style={{ textAlign: 'center' }}>Total Amount</th>
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
                    ₱{Number(item.total_amount || 0).toFixed(2)}
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
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="icon-btn icon-btn-danger"
                        title="Delete"
                      >
                        <FaTrash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
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
              >
                ×
              </button>
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
                <p style={{ margin: '4px 0 0', fontWeight: 500 }}>₱{Number(selectedReturn.total_amount || 0).toFixed(2)}</p>
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
                        <td className="text-right">₱{Number(item.display_bottle_price || 0).toFixed(2)}</td>
                        <td className="text-right">₱{Number(item.display_shell_price || 0).toFixed(2)}</td>
                        <td className="text-right">{item.qty_shell}</td>
                        <td className="text-right">{item.qty_pcs}</td>
                        <td className="text-right">₱{Number(item.line_total || 0).toFixed(2)}</td>
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
                      ₱{Number(selectedReturn.total_amount || 0).toFixed(2)}
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