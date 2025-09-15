import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faUser, faSignOutAlt, faWarehouse, faExchangeAlt } from "@fortawesome/free-solid-svg-icons";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const Header = ({ toggleSidebar }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Get user data from localStorage
    const userData = localStorage.getItem("user");
    
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      
      // For admin users only, check if there's a different selected warehouse
      if (parsedUser.role?.toLowerCase() === "admin") {
        const warehouseData = localStorage.getItem("selectedWarehouse");
        if (warehouseData) {
          setSelectedWarehouse(JSON.parse(warehouseData));
        }
      }
    }
  }, []);

  // Check if user is admin
  const isAdmin = user?.role?.toLowerCase() === "admin";

  // Fetch warehouses from API
  const fetchWarehouses = async () => {
    setLoadingWarehouses(true);
    try {
      const res = await axios.get("http://localhost:8080/api/warehouses/");
      setWarehouses(res.data);
    } catch (err) {
      console.error("Failed to fetch warehouses:", err);
    } finally {
      setLoadingWarehouses(false);
    }
  };

  // Handle opening warehouse modal
  const handleOpenWarehouseModal = () => {
    setShowWarehouseModal(true);
    fetchWarehouses();
  };

  // Handle warehouse selection (only for admin)
  const handleWarehouseSelection = (warehouse) => {
    setSelectedWarehouse(warehouse);
    localStorage.setItem("selectedWarehouse", JSON.stringify(warehouse));
    setShowWarehouseModal(false);
    
    // Enhanced: Dispatch custom event with more details
    window.dispatchEvent(new CustomEvent('warehouseChanged', { 
      detail: { 
        warehouse,
        action: 'select',
        source: 'header'
      } 
    }));
  };

  // Close modal function
  const closeModal = () => {
    setShowWarehouseModal(false);
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("access");
    localStorage.removeItem("selectedWarehouse");
    window.location.href = "/login";
  };

  // Get the warehouse name to display - always prioritize user's enrolled warehouse
  const getDisplayWarehouse = () => {
    // For non-admin users: ALWAYS show their enrolled warehouse
    if (!isAdmin) {
      if (user?.warehouse) {
        return user.warehouse;
      }
      return "No Warehouse Assigned";
    }
    
    // For admin users: show selected warehouse OR their enrolled warehouse
    if (isAdmin) {
      // If admin has selected a different warehouse, show that
      if (selectedWarehouse?.name) {
        return selectedWarehouse.name;
      }
      // Otherwise show their enrolled warehouse
      if (user?.warehouse) {
        return user.warehouse;
      }
      return "No Warehouse Assigned";
    }
    
    return "No Warehouse Assigned";
  };

  return (
    <>
      <header className="bg-gray-900 text-white px-6 py-3 flex justify-between items-center shadow-md fixed w-full top-0 z-10">
        {/* Left - Toggle Button & Logo */}
        <div className="flex items-center">
          <button onClick={toggleSidebar} className="text-xl mr-4 focus:outline-none">
            <FontAwesomeIcon icon={faBars} />
          </button>
          <h1 className="text-xl font-bold">Coke Sales and Inventory System</h1>
        </div>

        {/* Center - Current Warehouse Display */}
        <div className="flex items-center">
          <button
            onClick={isAdmin ? handleOpenWarehouseModal : undefined}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors focus:outline-none border ${
              isAdmin 
                ? "bg-gray-700 hover:bg-gray-600 border-gray-600 cursor-pointer" 
                : "bg-gray-800 border-gray-700 cursor-default"
            }`}
            disabled={!isAdmin}
            title={
              isAdmin 
                ? "Click to switch warehouse" 
                : `Your enrolled warehouse: ${user?.warehouse || 'Not assigned'}`
            }
          >
            <FontAwesomeIcon icon={faWarehouse} />
            <span className="font-medium">
              {getDisplayWarehouse()}
            </span>
            {isAdmin && <FontAwesomeIcon icon={faExchangeAlt} className="text-sm" />}
          </button>
        </div>

        {/* Right - Profile Dropdown */}
        <div className="relative">
          <Link to="/profile" className="focus:outline-none">
            <FontAwesomeIcon icon={faUser} className="cursor-pointer" />
          </Link>
        </div>
      </header>

      {/* Warehouse Selection Modal (Only for Admin) */}
      {showWarehouseModal && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white">
                Switch Warehouse
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {loadingWarehouses ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-300">Loading warehouses...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Your enrolled warehouse: <strong>{user?.warehouse || 'None'}</strong>
                </p>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Select a different warehouse to switch to:
                </p>
                
                {warehouses.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No warehouses available</p>
                ) : (
                  warehouses.map((warehouse) => (
                    <div
                      key={warehouse.id}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                        selectedWarehouse?.id === warehouse.id
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-600 hover:border-blue-300"
                      }`}
                      onClick={() => handleWarehouseSelection(warehouse)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-800 dark:text-white">
                            {warehouse.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {warehouse.street}, {warehouse.city}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {warehouse.country}
                          </p>
                        </div>
                        {selectedWarehouse?.id === warehouse.id && (
                          <div className="text-blue-600 dark:text-blue-400">
                            <FontAwesomeIcon icon={faWarehouse} className="text-lg" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}

                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-600">
                  <button
                    onClick={() => {
                      // Reset to enrolled warehouse
                      setSelectedWarehouse(null);
                      localStorage.removeItem("selectedWarehouse");
                      closeModal();
                      
                      // Enhanced: Dispatch event for warehouse reset
                      window.dispatchEvent(new CustomEvent('warehouseChanged', { 
                        detail: { 
                          warehouse: null, 
                          action: 'reset',
                          source: 'header'
                        } 
                      }));
                    }}
                    className="px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-all"
                  >
                    Reset to My Warehouse
                  </button>
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Header;