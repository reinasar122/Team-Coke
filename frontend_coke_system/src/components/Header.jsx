// src/components/Header.jsx - Fixed Dark Mode Implementation
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faUser, faWarehouse, faExchangeAlt, faSun, faMoon } from "@fortawesome/free-solid-svg-icons";
import { useState, useEffect, useRef } from "react";
import Notification from "./Notification";
import Profile from "../pages/Profile";
import api from "../api";
import ModalShell from "./common/ModalShell";

const Header = ({ toggleSidebar }) => {
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [user, setUser] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const dropdownRef = useRef(null);

  // Initialize and setup dark mode
  useEffect(() => {
    // Check for saved theme or system preference
    const savedTheme = localStorage.getItem('darkMode');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    let shouldBeDark = false;
    
    if (savedTheme !== null) {
      shouldBeDark = savedTheme === 'true';
    } else {
      shouldBeDark = prefersDark;
    }
    
    setIsDarkMode(shouldBeDark);
    applyDarkMode(shouldBeDark);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (localStorage.getItem('darkMode') === null) {
        setIsDarkMode(e.matches);
        applyDarkMode(e.matches);
      }
    };
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }
    
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  // Apply dark mode to document
  const applyDarkMode = (isDark) => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode.toString());
    applyDarkMode(newDarkMode);
  };

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);

      if (String(parsedUser.role || "").toLowerCase().includes("admin")) {
        const warehouseData = localStorage.getItem("selectedWarehouse");
        if (warehouseData) {
          setSelectedWarehouse(JSON.parse(warehouseData));
        }
      }
    }

    // Close profile dropdown when clicking outside
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const normalizedRole = String(user?.role || "").toLowerCase();
  const isAdmin = normalizedRole.includes("admin");

  const fetchWarehouses = async () => {
    setLoadingWarehouses(true);
    try {
      const res = await api.get("/warehouses/");
      setWarehouses(res.data);
    } catch (err) {
      console.error("Failed to fetch warehouses:", err);
    } finally {
      setLoadingWarehouses(false);
    }
  };

  const handleOpenWarehouseModal = () => {
    setShowWarehouseModal(true);
    fetchWarehouses();
  };

  const handleWarehouseSelection = (warehouse) => {
    setSelectedWarehouse(warehouse);
    localStorage.setItem("selectedWarehouse", JSON.stringify(warehouse));
    setShowWarehouseModal(false);

    window.dispatchEvent(
      new CustomEvent("warehouseChanged", {
        detail: { warehouse, action: "select", source: "header" },
      })
    );
  };

  const closeModal = () => setShowWarehouseModal(false);

  const getDisplayWarehouse = () => {
    if (!isAdmin) return user?.warehouse || "No Warehouse Assigned";
    if (selectedWarehouse?.name) return selectedWarehouse.name;
    return user?.warehouse || "No Warehouse Assigned";
  };

  return (
    <>
      <header className="app-shell-header fixed left-0 right-0 top-0 z-40 bg-gray-900 px-4 py-3 text-white shadow-md transition-all duration-300 dark:bg-gray-950 sm:px-5 lg:px-6">
        <div className="app-shell-header__inner flex items-center gap-3">
          <div className="app-shell-header__left flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button
              onClick={toggleSidebar}
              className="app-shell-icon-btn app-shell-icon-btn--menu focus:outline-none"
              aria-label="Toggle sidebar"
            >
            <FontAwesomeIcon icon={faBars} />
            </button>
            <div className="min-w-0">
              <h1 className="app-shell-brand hidden truncate text-xl font-bold sm:block">
                Coke Sales and Inventory System
              </h1>
              <h1 className="app-shell-brand app-shell-brand--compact truncate text-lg font-bold sm:hidden">
                Coke POS
              </h1>
            </div>
          </div>

          <div className="app-shell-header__center hidden flex-1 justify-center md:flex">
            <button
              onClick={isAdmin ? handleOpenWarehouseModal : undefined}
              className={`app-shell-warehouse-switch ${
                isAdmin
                  ? "cursor-pointer hover:bg-gray-600 dark:hover:bg-gray-700"
                  : "cursor-default opacity-95"
              }`}
              disabled={!isAdmin}
            >
              <FontAwesomeIcon icon={faWarehouse} />
              <span className="truncate font-medium">{getDisplayWarehouse()}</span>
              {isAdmin && <FontAwesomeIcon icon={faExchangeAlt} className="text-sm" />}
            </button>
          </div>

          <div className="app-shell-header__right relative flex flex-1 items-center justify-end gap-2 sm:gap-3" ref={dropdownRef}>
            <button
              onClick={toggleDarkMode}
              className="app-shell-icon-btn group focus:outline-none focus:ring-2 focus:ring-blue-500"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              type="button"
            >
              <FontAwesomeIcon 
                icon={isDarkMode ? faSun : faMoon} 
                className={`text-lg transition-all duration-300 transform ${
                  isDarkMode ? 'text-yellow-400 rotate-180' : 'text-blue-300 rotate-0'
                } group-hover:scale-110`} 
              />
            </button>

            <Notification closeProfile={() => setIsProfileOpen(false)} />
          
            <div className="relative">
              <button 
                onClick={() => {
                  setIsProfileOpen(!isProfileOpen);
                  if (!isProfileOpen) {
                    window.dispatchEvent(new CustomEvent('profileOpened'));
                  }
                }} 
                className="app-shell-icon-btn focus:outline-none"
                type="button"
                aria-label="Open profile"
              >
                <FontAwesomeIcon icon={faUser} className="cursor-pointer text-xl" />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] sm:max-w-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg shadow-xl z-50 max-h-[calc(100vh-6rem)] overflow-y-auto border border-gray-200 dark:border-gray-700 transition-all duration-200">
                  <Profile />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Warehouse Display */}
      <div className="app-shell-header-mobile fixed left-0 right-0 top-16 z-10 bg-gray-800 px-4 py-2 text-white transition-all duration-300 dark:bg-gray-900 md:hidden">
        <button
          onClick={isAdmin ? handleOpenWarehouseModal : undefined}
          className={`app-shell-warehouse-switch app-shell-warehouse-switch--mobile mx-auto ${
            isAdmin
              ? "cursor-pointer hover:bg-gray-600 dark:hover:bg-gray-700"
              : "cursor-default opacity-95"
          }`}
          disabled={!isAdmin}
        >
          <FontAwesomeIcon icon={faWarehouse} />
          <span className="font-medium truncate">{getDisplayWarehouse()}</span>
          {isAdmin && <FontAwesomeIcon icon={faExchangeAlt} className="text-sm" />}
        </button>
      </div>

      {/* Warehouse Modal */}
      {showWarehouseModal && isAdmin && (
        <ModalShell
          open
          onClose={closeModal}
          size="sm"
          panelClassName="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto"
        >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white">
                Switch Warehouse
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100 text-2xl font-bold transition-colors p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                ×
              </button>
            </div>

            {loadingWarehouses ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-300">
                  Loading warehouses...
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {warehouses.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    No warehouses available
                  </p>
                ) : (
                  warehouses.map((warehouse) => (
                    <div
                      key={warehouse.id}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-lg ${
                        selectedWarehouse?.id === warehouse.id
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-900/30 shadow-md"
                          : "border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 bg-gray-50 dark:bg-gray-700"
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
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
        </ModalShell>
      )}
    </>
  );
};

export default Header;

