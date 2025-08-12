import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

const MerchandisingSaleDetailPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const sale = location.state?.data;
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [showHandlerDetails, setShowHandlerDetails] = useState(false);
  const [showProductStock, setShowProductStock] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [handlerInfo, setHandlerInfo] = useState(null);
  const [warehouseStock, setWarehouseStock] = useState([]);
  const [warehouseUsers, setWarehouseUsers] = useState([]);
// helpers
  const isVanLoad = (sale?.transaction_type_name || '').toLowerCase() === 'van load';
  const isComplete = (sale?.status || '').toLowerCase() === 'complete';

  // Get current warehouse from localStorage or user data
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    
    // For admin users, use selected warehouse or fallback to enrolled warehouse
    if (user.role?.toLowerCase() === "admin") {
      setCurrentWarehouse(selectedWarehouse || { id: user.warehouse_id, name: user.warehouse });
    } else {
      // For non-admin users, always use their enrolled warehouse
      setCurrentWarehouse({ id: user.warehouse_id, name: user.warehouse });
    }

    // Listen for warehouse changes (from Header component)
    const handleWarehouseChange = (event) => {
      const { warehouse } = event.detail;
      if (warehouse) {
        setCurrentWarehouse(warehouse);
      } else {
        // Reset to user's enrolled warehouse
        setCurrentWarehouse({ id: user.warehouse_id, name: user.warehouse });
      }
    };

    window.addEventListener('warehouseChanged', handleWarehouseChange);
    return () => window.removeEventListener('warehouseChanged', handleWarehouseChange);
  }, []);

  if (!sale) {
    return <div className="p-4 text-red-600">No sale data available.</div>;
  }

  const totalAmount =
    (parseFloat(sale.total_trading_amount) || 0) +
    (parseFloat(sale.total_expenses_amount) || 0);

  // Function to fetch handler details for the warehouse
  const fetchHandlerDetails = async () => {
    if (showHandlerDetails) {
      setShowHandlerDetails(false);
      return;
    }
    
    try {
      // Since you don't have a users endpoint in your backend, let's create mock data
      // You'll need to add a User viewset to your backend or modify this
      const handlerData = {
        user_name: sale.handled_by,
        warehouse_name: sale.warehouse_name || currentWarehouse?.name,
        user_role: "Staff", // You'll need to get this from your User model
        date_handled: sale.date_time,
        contact: "N/A", // You'll need to get this from your User model
        user_id: "N/A"
      };
      
      setHandlerInfo(handlerData);
      setShowHandlerDetails(true);
    } catch (error) {
      console.error("Error fetching handler details:", error);
      // Fallback data if API fails
      const fallbackData = {
        user_name: sale.handled_by,
        warehouse_name: sale.warehouse_name || currentWarehouse?.name,
        user_role: "Staff",
        date_handled: sale.date_time,
        contact: "N/A"
      };
      setHandlerInfo(fallbackData);
      setShowHandlerDetails(true);
    }
  };

  // Function to fetch all warehouse users
  const fetchAllWarehouseUsers = async () => {
    if (showAllUsers) {
      setShowAllUsers(false);
      return;
    }
    
    try {
      // You'll need to create this endpoint in your backend
      // For now, let's create mock data
      const mockUsers = [
        {
          id: 1,
          first_name: "John",
          last_name: "Doe",
          role: "Manager",
          email: "john.doe@example.com",
          is_active: true
        },
        {
          id: 2,
          first_name: "Jane",
          last_name: "Smith",
          role: "Staff",
          email: "jane.smith@example.com",
          is_active: true
        },
        // Add the current handler
        {
          id: 3,
          first_name: sale.handled_by.split(' ')[0] || "Unknown",
          last_name: sale.handled_by.split(' ')[1] || "User",
          role: "Staff",
          email: "N/A",
          is_active: true
        }
      ];
      
      setWarehouseUsers(mockUsers);
      setShowAllUsers(true);
    } catch (error) {
      console.error("Error fetching warehouse users:", error);
    }
  };

  // Function to fetch product stock for current warehouse
  const fetchWarehouseStock = async () => {
    if (showProductStock) {
      setShowProductStock(false);
      return;
    }

    try {
      // Get merchandising items from the current sale to show their stock
      const response = await axios.get(`http://localhost:8080/api/merchandising/${sale.id}/`);
      const merchandising = response.data;
      
      if (merchandising.items && merchandising.items.length > 0) {
        // Get stock for each product using your StockAvailabilityView
        const stockPromises = merchandising.items.map(async (item) => {
          try {
            const stockResponse = await axios.get(`http://localhost:8080/api/stocks/${item.product.id}/`, {
              params: { warehouse: currentWarehouse?.id }
            });
            return {
              product_id: item.product.id,
              product_name: item.product.product_name,
              available_stock: stockResponse.data.quantity_available,
              warehouse_id: currentWarehouse?.id,
              warehouse_name: currentWarehouse?.name,
              last_updated: new Date().toLocaleDateString()
            };
          } catch (error) {
            console.error(`Error fetching stock for product ${item.product.id}:`, error);
            return {
              product_id: item.product.id,
              product_name: item.product.product_name,
              available_stock: 0,
              warehouse_id: currentWarehouse?.id,
              warehouse_name: currentWarehouse?.name,
              last_updated: new Date().toLocaleDateString()
            };
          }
        });
        
        const stockData = await Promise.all(stockPromises);
        setWarehouseStock(stockData);
        setShowProductStock(true);
      } else {
        // If no items, show mock data or empty state
        setWarehouseStock([]);
        setShowProductStock(true);
      }
    } catch (error) {
      console.error("Error fetching warehouse stock:", error);
      // Show mock data for testing
      const mockStock = [
        {
          product_id: 1,
          product_name: "Sample Product 1",
          available_stock: 100,
          warehouse_id: currentWarehouse?.id,
          warehouse_name: currentWarehouse?.name,
          last_updated: new Date().toLocaleDateString()
        },
        {
          product_id: 2,
          product_name: "Sample Product 2",
          available_stock: 50,
          warehouse_id: currentWarehouse?.id,
          warehouse_name: currentWarehouse?.name,
          last_updated: new Date().toLocaleDateString()
        }
      ];
      setWarehouseStock(mockStock);
      setShowProductStock(true);
    }
  };

  const showCustomConfirmDialog = (message, onConfirm) => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
        <p class="text-gray-700 dark:text-gray-300 mb-4">${message}</p>
        <div class="flex justify-end space-x-3">
          <button class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cancel-btn">Cancel</button>
          <button class="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded confirm-btn">Confirm</button>
        </div>
      </div>
    `;
    
    modal.querySelector('.cancel-btn').onclick = () => {
      document.body.removeChild(modal);
    };
    
    modal.querySelector('.confirm-btn').onclick = () => {
      document.body.removeChild(modal);
      onConfirm();
    };
    
    document.body.appendChild(modal);
  };

  return (
    <div className="p-6">
      {/* Warehouse Display */}
      <div className="mb-4 p-4 bg-blue-600 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-blue-100">Current Warehouse:</span>
            <span className="ml-2 text-white font-bold text-lg">
              {currentWarehouse?.name || "No Warehouse Selected"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-4 mt-6 max-w-7xl mx-auto">
        {isVanLoad && !isComplete && (
          <button
            className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 transition"
            onClick={() =>
              navigate('/van-load-update', { state: { id: sale.id, warehouse: currentWarehouse } })
            }
          >
            Receive Return
          </button>
        )}
      </div>

      {/* ✅ Sale detail contents */}
      <h2 className="text-2xl font-bold mb-4">Sale Details</h2>

      <table className="min-w-full border border-collapse bg-white shadow">
        <tbody>
          <tr>
            <td className="border px-4 py-2 font-semibold">MSP No</td>
            <td className="border px-4 py-2">{sale.msp_no}</td>
          </tr>
          <tr>
            <td className="border px-4 py-2 font-semibold">Date Time</td>
            <td className="border px-4 py-2">{sale.date_time}</td>
          </tr>
          <tr>
            <td className="border px-4 py-2 font-semibold">Transaction Type</td>
            <td className="border px-4 py-2">{sale.transaction_type_name}</td>
          </tr>
          {sale.transaction_type_name === "Warehouse" && (
            <tr>
              <td className="border px-4 py-2 font-semibold">Customer Name</td>
              <td className="border px-4 py-2">{sale.customer_name}</td>
            </tr>
          )}
          <tr>
            <td className="border px-4 py-2 font-semibold">Handled By</td>
            <td className="border px-4 py-2">
              <div className="flex flex-col gap-2">
                <button 
                  onClick={fetchHandlerDetails}
                  className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium text-left"
                >
                  {sale.handled_by} - {sale.warehouse_name || currentWarehouse?.name || "N/A"}
                  <span className="ml-1 text-sm">👤</span>
                </button>
                <button 
                  onClick={fetchAllWarehouseUsers}
                  className="text-purple-600 hover:text-purple-800 hover:underline cursor-pointer font-medium text-left text-sm"
                >
                  View All Users in {currentWarehouse?.name || "Warehouse"}
                  <span className="ml-1 text-sm">👥</span>
                </button>
              </div>
            </td>
          </tr>
          <tr>
            <td className="border px-4 py-2 font-semibold">Warehouse</td>
            <td className="border px-4 py-2">{sale.warehouse_name || currentWarehouse?.name || "N/A"}</td>
          </tr>
          <tr>
            <td className="border px-4 py-2 font-semibold">
              {sale.transaction_type_name === "Van Load"
                ? "Expected Sale"
                : "Total Amount"}
            </td>
            <td className="border px-4 py-2">
              ₱
              {(
                sale.transaction_type_name === "Van Load"
                  ? parseFloat(sale.expected_sale) || 0
                  : totalAmount
              ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </td>
          </tr>
          <tr>
            <td className="border px-4 py-2 font-semibold">Products</td>
            <td className="border px-4 py-2">
              <button 
                onClick={fetchWarehouseStock}
                className="text-green-600 hover:text-green-800 hover:underline cursor-pointer font-medium"
              >
                View Available Stock in {currentWarehouse?.name || "Warehouse"}
                <span className="ml-1 text-sm">📦</span>
              </button>
            </td>
          </tr>
          <tr>
            <td className="border px-4 py-2 font-semibold">Status</td>
            <td className="border px-4 py-2">{sale.status}</td>
          </tr>
        </tbody>
      </table>

      {/* Handler Details Modal */}
      {showHandlerDetails && handlerInfo && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex justify-between items-start">
            <h4 className="text-lg font-semibold text-blue-800 mb-3">Handler Details</h4>
            <button 
              onClick={() => setShowHandlerDetails(false)}
              className="text-blue-600 hover:text-blue-800 text-xl"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <span className="font-medium text-blue-700">User Name:</span>
              <p className="text-blue-900">{handlerInfo.user_name}</p>
            </div>
            <div>
              <span className="font-medium text-blue-700">Warehouse:</span>
              <p className="text-blue-900">{handlerInfo.warehouse_name}</p>
            </div>
            <div>
              <span className="font-medium text-blue-700">Role:</span>
              <p className="text-blue-900">{handlerInfo.user_role}</p>
            </div>
            <div>
              <span className="font-medium text-blue-700">Date Handled:</span>
              <p className="text-blue-900">{handlerInfo.date_handled}</p>
            </div>
            <div>
              <span className="font-medium text-blue-700">Contact:</span>
              <p className="text-blue-900">{handlerInfo.contact}</p>
            </div>
            {handlerInfo.user_id !== "N/A" && (
              <div>
                <span className="font-medium text-blue-700">User ID:</span>
                <p className="text-blue-900">{handlerInfo.user_id}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* All Warehouse Users Modal */}
      {showAllUsers && (
        <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex justify-between items-start mb-4">
            <h4 className="text-lg font-semibold text-purple-800">
              All Users - {currentWarehouse?.name}
            </h4>
            <button 
              onClick={() => setShowAllUsers(false)}
              className="text-purple-600 hover:text-purple-800 text-xl"
            >
              ×
            </button>
          </div>
          {warehouseUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-collapse bg-white shadow-sm">
                <thead className="bg-purple-100">
                  <tr>
                    <th className="border px-4 py-2 text-left font-semibold text-purple-800">Name</th>
                    <th className="border px-4 py-2 text-left font-semibold text-purple-800">Role</th>
                    <th className="border px-4 py-2 text-left font-semibold text-purple-800">Email</th>
                    <th className="border px-4 py-2 text-left font-semibold text-purple-800">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouseUsers.map((user, index) => (
                    <tr key={index} className="hover:bg-purple-50">
                      <td className="border px-4 py-2">
                        <span className={`font-medium ${
                          `${user.first_name} ${user.last_name}` === sale.handled_by 
                            ? 'text-purple-600 bg-purple-100 px-2 py-1 rounded' 
                            : ''
                        }`}>
                          {user.first_name} {user.last_name}
                        </span>
                      </td>
                      <td className="border px-4 py-2">{user.role}</td>
                      <td className="border px-4 py-2">{user.email}</td>
                      <td className="border px-4 py-2">
                        <span className={`px-2 py-1 rounded text-sm ${
                          user.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-purple-700">No users found.</p>
            </div>
          )}
        </div>
      )}

      {/* Warehouse Stock Modal */}
      {showProductStock && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex justify-between items-start mb-4">
            <h4 className="text-lg font-semibold text-green-800">
              Available Stock - {currentWarehouse?.name}
            </h4>
            <button 
              onClick={() => setShowProductStock(false)}
              className="text-green-600 hover:text-green-800 text-xl"
            >
              ×
            </button>
          </div>
          {warehouseStock.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-collapse bg-white shadow-sm">
                <thead className="bg-green-100">
                  <tr>
                    <th className="border px-4 py-2 text-left font-semibold text-green-800">Product Name</th>
                    <th className="border px-4 py-2 text-left font-semibold text-green-800">Available Stock</th>
                    <th className="border px-4 py-2 text-left font-semibold text-green-800">Status</th>
                    <th className="border px-4 py-2 text-left font-semibold text-green-800">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouseStock.map((product, index) => (
                    <tr key={index} className="hover:bg-green-50">
                      <td className="border px-4 py-2">{product.product_name}</td>
                      <td className="border px-4 py-2 font-semibold">
                        <span className={product.available_stock > 0 ? 'text-green-600' : 'text-red-600'}>
                          {product.available_stock}
                        </span>
                      </td>
                      <td className="border px-4 py-2">
                        <span className={`px-2 py-1 rounded text-sm ${
                          product.available_stock > 0 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {product.available_stock > 0 ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </td>
                      <td className="border px-4 py-2 text-sm text-gray-600">{product.last_updated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-green-700">No products found.</p>
            </div>
          )}
        </div>
      )}

      {/* ✅ Back button */}
      <div className="flex justify-end gap-4 mt-6 max-w-7xl mx-auto">
        <button
          className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600 transition"
          onClick={() => {
            showCustomConfirmDialog(
              "Are you sure you want to go back? Unsaved changes will be lost.",
              () => navigate("/trading")
            );
          }}
        >
          BACK
        </button>
      </div>
    </div>
  );
};

export default MerchandisingSaleDetailPage;