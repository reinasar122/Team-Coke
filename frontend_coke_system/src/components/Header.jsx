// src/components/Header.jsx - Fixed version
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faUser, faWarehouse, faExchangeAlt } from "@fortawesome/free-solid-svg-icons";
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Notification from "./Notification"; // Import the notification component
import Profile from "../pages/Profile"; // 👈 import your Profile.jsx
import api from "../api"; // ensure api is imported so env vars are loaded import ".";

const Header = ({ toggleSidebar }) => {
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [user, setUser] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);

      if (parsedUser.role?.toLowerCase() === "admin") {
        const warehouseData = localStorage.getItem("selectedWarehouse");
        if (warehouseData) {
          setSelectedWarehouse(JSON.parse(warehouseData));
        }
      }
    }
     // close profile dropdown when clicking outside
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAdmin = user?.role?.toLowerCase() === "admin";
  

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

  // Get the warehouse name to display - always prioritize user's enrolled warehouse
  const getDisplayWarehouse = () => {
    if (!isAdmin) return user?.warehouse || "No Warehouse Assigned";
    if (selectedWarehouse?.name) return selectedWarehouse.name;
    return user?.warehouse || "No Warehouse Assigned";
  };

  return (
    <>
      <header className="bg-gray-900 text-white px-6 py-3 flex justify-between items-center shadow-md fixed w-full mb-10 top-0 z-10">
        {/* Left - Sidebar toggle + title */}
        <div className="flex items-center">
          <button
            onClick={toggleSidebar}
            className="text-xl mr-4 focus:outline-none"
          >
            <FontAwesomeIcon icon={faBars} />
          </button>
          <h1 className="text-xl font-bold hidden sm:block">Coke Sales and Inventory System</h1>
          <h1 className="text-lg font-bold sm:hidden">Coke POS</h1>
        </div>

        {/* Center - Warehouse Display */}
        <div className="hidden md:block">
          <button
            onClick={isAdmin ? handleOpenWarehouseModal : undefined}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors focus:outline-none border ${
              isAdmin
                ? "bg-gray-700 hover:bg-gray-600 border-gray-600 cursor-pointer"
                : "bg-gray-800 border-gray-700 cursor-default"
            }`}
            disabled={!isAdmin}
          >
            <FontAwesomeIcon icon={faWarehouse} />
            <span className="font-medium truncate max-w-48">{getDisplayWarehouse()}</span>
            {isAdmin && (
              <FontAwesomeIcon icon={faExchangeAlt} className="text-sm" />
            )}
          </button>
        </div>

        {/* Right - Profile Dropdown */}
        <div className="flex items-center space-x-4 relative" ref={dropdownRef}>
          {/* Notification Component */}
          <Notification />
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="focus:outline-none"
          >
            <FontAwesomeIcon icon={faUser} className="cursor-pointer text-xl" />
          </button>

          {/* Profile Dropdown - Fixed positioning */}
          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] sm:max-w-sm bg-white text-gray-800 rounded-lg shadow-xl z-50 max-h-[calc(100vh-6rem)] overflow-y-auto border border-gray-200">
              <Profile/> {/* compact version */}
            </div>
          )}
        </div>
      </header>

      {/* Mobile Warehouse Display */}
      <div className="md:hidden bg-gray-800 text-white px-6 py-2 fixed w-full top-16 z-10">
        <button
          onClick={isAdmin ? handleOpenWarehouseModal : undefined}
          className={`w-full px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors focus:outline-none border ${
            isAdmin
              ? "bg-gray-700 hover:bg-gray-600 border-gray-600 cursor-pointer"
              : "bg-gray-800 border-gray-700 cursor-default"
          }`}
          disabled={!isAdmin}
        >
          <FontAwesomeIcon icon={faWarehouse} />
          <span className="font-medium truncate">{getDisplayWarehouse()}</span>
          {isAdmin && (
            <FontAwesomeIcon icon={faExchangeAlt} className="text-sm" />
          )}
        </button>
      </div>

      {/* Warehouse Modal */}
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
                <p className="mt-4 text-gray-600 dark:text-gray-300">
                  Loading warehouses...
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {warehouses.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No warehouses available
                  </p>
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
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Header;