import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

// Layout Components
import MerchandisingSale from "./components/merchandisingcomponents/MerchandisingSale";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import { NotificationProvider } from "./contexts/NotificationContext";
import "./index.css";
import "./styles/global.scss";

// Pages
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import WarehouseForm from "./pages/WarehouseForm";
import Warehouses from "./pages/Warehouses";
import EditWarehouse from "./pages/EditWarehouse";
import Suppliers from "./pages/Suppliers";
import SupplierRegistrationForm from "./pages/SupplierRegistrationForm";
import SupplierEditForm from "./pages/SupplierEditForm";
import Stocks from "./pages/Stocks";
import UserList from "./pages/UserList";
import UserForm from "./pages/UserForm";
import RoleList from "./pages/RoleList";
import RoleForm from "./pages/RoleForm";
import ProductForm from "./pages/ProductForm";
import ProductEdit from "./pages/ProductEdit";
import ProductList from "./pages/ProductList";
import EditRoleAccessWrapper from "./pages/EditRoleAccessWrapper";
import VanList from "./pages/VanList";
import ReceivingList from "./pages/ReceivingList";
import ReceivingForm from "./pages/ReceivingForm";
import MerchandisingList from "./pages/MerchandisingList";
import Merchandising from "./pages/Merchandising";
import MerchandisingSaleDetailPage from "./pages/MerchandisingSaleDetailPage";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyOTP from "./pages/VerifyOTP";
import Expenses from "./pages/Expenses";
import VanLoadUpdate from "./pages/VanLoadUpdate";
import SupplierReturnForm from "./pages/SupplierReturnForm";
import SupplierReturnList from "./pages/SupplierReturnList";
import ReturnEmpties from "./pages/ReturnEmpties";
import WarehouseProductDetails from "./pages/WarehouseProductDetails";
import ReceivingDetails from "./pages/ReceivingDetails";
import VanLoadProductDetails from "./pages/VanLoadProductDetails";
import Settings from "./pages/Settings";
// ✅ NEW: Import ExpenseSettings component
import ExpenseSettings from "./components/Settings";

// Dashboard Page
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import SalesReport from "./pages/reports/SalesReport.jsx";

// Credits
import CreditList from "./pages/CreditList";
import CreditDetail from "./pages/CreditDetail";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Invoice from "./pages/Invoice";

import ForecastingDashboard from "./pages/ForecastingDashboard";
// ✅ Customer Registration Component
import CustomerRegistration from './components/merchandisingcomponents/CustomerRegistration';

import {
  FaHome,
  FaClipboardCheck,
  FaChartLine,
  FaFileInvoice,
  FaBoxes,
  FaTruck,
  FaChartPie,
  FaCogs,
  FaUsers,
  FaUserShield,
  FaWarehouse,
  FaUndoAlt,
  FaChartBar,   // ✅ for Sales Report title
  FaMoneyBillWave,
  FaDollarSign, // ✅ NEW: for Expense Settings
  FaUserFriends, // ✅ ADD: for Customers
} from "react-icons/fa";

// ✅ Check if user is logged in
const isAuthenticated = () => {
  return localStorage.getItem("user") !== null;
};

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || 'null');

  // Not logged in → force login
  if (!user) return <Navigate to="/login" replace />;

  // Force password change
  const requiresPasswordChange = user?.requires_password_change;
  const isOnChangePasswordPage = location.pathname.startsWith("/change-password");

  if (requiresPasswordChange && !isOnChangePasswordPage) {
    return <Navigate to="/change-password" replace />;
  }

  return children;
};

// ✅ Layout wrapper for protected pages
const ProtectedLayout = ({ isSidebarOpen, toggleSidebar }) => {
  const location = useLocation();
  const hiddenRoutes = [
    "/change-password",
    "/forgot-password",
    "/verify-otp",
    "/login",
  ];
  const hideLayout = hiddenRoutes.includes(location.pathname);

  // Pages where we want to HIDE the universal scrollbar
  const lockPrefixes = ["/vans", "/suppliers", "/trading"];
  const path = location.pathname.toLowerCase();
  const lockScroll = lockPrefixes.some(p => path === p || path.startsWith(p + "/"));

  return (
    <div className="flex flex-col h-screen">
      {!hideLayout && <Header toggleSidebar={toggleSidebar} />}
      <div className="flex flex-1">
        {!hideLayout && <Sidebar isSidebarOpen={isSidebarOpen} />}

        {/* 👇 app-content + conditional lock */}
        <div
          className={`app-content ${lockScroll ? "lock-scroll" : "allow-page-scroll"} p-5 flex-1 transition-all duration-300 ${
            !hideLayout && isSidebarOpen ? "ml-64 pt-16" : "ml-0"
          }`}
        >
          {/* Page Titles */}
          {!hideLayout && (
            <div className="page-title mb-4">
              <Routes>
                <Route
                  path="/"
                  element={
                    <h1 className="text-2xl flex items-center gap-2">
                      <FaHome /> Home Page
                    </h1>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <h1 className="text-2xl flex items-center gap-2">
                      <FaChartPie /> Dashboard
                    </h1>
                  }
                />

                {/* ✅ Customer page titles */}
                <Route
                  path="/customers"
                  element={
                    <h1 className="text-2xl flex items-center gap-2">
                      <FaUserFriends /> Customers
                    </h1>
                  }
                />
                <Route
                  path="/customer-registration"
                  element={
                    <h1 className="text-2xl flex items-center gap-2">
                      <FaUserFriends /> Customer Registration
                    </h1>
                  }
                />

                <Route path="/receiving" />
                <Route path="/stocks" />
                <Route path="/products" />
                <Route path="/suppliers" />
                <Route
                  path="/settings"
                  element={
                    <h1 className="text-2xl flex items-center gap-2">
                      <FaCogs /> Settings
                    </h1>
                  }
                />

                {/* Forecasting page title */}
                <Route
                  path="/forecasting"
                  element={
                    <h1 className="text-2xl flex items-center gap-2">
                      <FaChartLine /> Forecasting
                    </h1>
                  }
                />

                {/* ✅ NEW: Expense Settings page title */}
                <Route
                  path="/expense-settings"
                  element={
                    <h1 className="text-2xl flex items-center gap-2">
                      <FaDollarSign /> Expense Settings
                    </h1>
                  }
                />
                <Route path="/profile" />
                <Route path="/invoice" />
                <Route
                  path="/StocksAdjustment"
                  element={
                    <h1 className="text-2xl flex items-center gap-2">
                      <FaTruck /> Stocks Adjustment
                    </h1>
                  }
                />
                <Route
                  path="/supplier-returns"
                  element={
                    <h1 className="text-2xl flex items-center mt-4 gap-2">
                      <FaTruck /> Supplier Returns
                    </h1>
                  }
                />
                <Route path="/return-empties" />
                <Route path="/credits" />
                <Route
                  path="/credits/:id"
                  element={
                    <h1 className="text-2xl flex items-center gap-2">
                      Credit Detail
                    </h1>
                  }
                />

                {/* ✅ Sales Report page title */}
                <Route
                  path="/reports/sales"
                  element={
                    <h1 className="text-2xl flex items-center gap-2">
                      <FaChartBar /> Sales Report
                    </h1>
                  }
                />

                <Route path="/expenses" />
              </Routes>
            </div>
          )}

          {/* Page Routes */}
          <Routes>
            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Dashboard */}
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Forecasting */}
            <Route path="/forecasting" element={<ForecastingDashboard />} />

            {/* ✅ Customer Routes */}
            <Route path="/customer-registration" element={<CustomerRegistration />} />
            <Route path="/customers" element={<Navigate to="/customer-registration" replace />} />

            {/* Credits */}
            <Route path="/credits" element={<CreditList />} />
            <Route path="/credits/:id" element={<CreditDetail />} />
            
            {/* Invoices */}  
            <Route path="/invoice" element={<Invoice />} />      

            {/* Warehouse */}
            <Route path="/warehouses" element={<Warehouses />} />
            <Route path="/warehouseForm" element={<WarehouseForm />} />
            <Route path="/editWarehouse/:id" element={<EditWarehouse />} />

            {/* Suppliers */}
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/register-supplier" element={<SupplierRegistrationForm />} />
            <Route path="/edit-supplier/:id" element={<SupplierEditForm />} />

            {/* Stocks */}
            <Route path="/stocks" element={<Stocks />} />

            {/* Users & Roles */}
            <Route path="/users" element={<UserList />} />
            <Route path="/create-user" element={<UserForm />} />
            <Route path="/roles" element={<RoleList />} />
            <Route path="/create-role" element={<RoleForm onClose={() => {}} />} />

            {/* Products */}
            <Route path="/products" element={<ProductList />} />
            <Route path="/products/new" element={<ProductForm />} />
            <Route path="/products/:id/edit" element={<ProductEdit />} />

            {/* Vans & Receiving */}
            <Route path="/vans" element={<VanList />} />
            <Route path="/receiving" element={<ReceivingList />} />
            <Route path="/receiving/:id" element={<ReceivingDetails />} />
            <Route path="/receiving/new" element={<ReceivingForm />} />

            {/* Merchandising */}
            <Route path="/trading" element={<MerchandisingList />} />
            <Route
              path="/merchandising"
              element={
                <>
                  <h1 className="text-2xl flex items-center gap-2 mb-4">
                    <FaChartLine /> Create New Sale
                  </h1>
                  <Merchandising />
                </>
              }
            />
            <Route
              path="/merchandising-sale"
              element={
                <MerchandisingSale key={window.location.key || Date.now()} />
              }
            />

            <Route path="/merchandising-sale/:id" element={<MerchandisingSaleDetailPage />} />

            {/* Profile & Expenses */}
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/expences" element={<Navigate to="/expenses" replace />} />

            {/* ✅ NEW: Expense Settings Route */}
            <Route path="/expense-settings" element={<ExpenseSettings />} />
            <Route path="/settings/expenses" element={<Navigate to="/expense-settings" replace />} />

            {/* Supplier Returns */}
            <Route path="/supplier-returns" element={<SupplierReturnList />} />
            <Route path="/supplier-returns/new" element={<SupplierReturnForm />} />
            <Route path="/return-empties" element={<ReturnEmpties />} />

            {/* Sales Report */}
            <Route path="/reports/sales" element={<SalesReport />} />
            <Route path="/salesreport" element={<Navigate to="/reports/sales" replace />} />

            {/* Warehouse Details */}
            <Route path="/warehouse-details/:mspNo" element={<WarehouseProductDetails />} />

            {/* Van Load */}
            <Route path="/van-load-update" element={<VanLoadUpdate />} />
            <Route path="/van-load-product-details/:id" element={<VanLoadProductDetails />} />

            {/* Edit Role Access */}
            <Route path="/edit-role-access/:id" element={<EditRoleAccessWrapper />} />

            {/* ✅ Fallback for unmatched routes - redirect to dashboard if authenticated */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

// ✅ Main App Component with NotificationProvider
function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Loading state to prevent flickering before rendering the page
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ✅ FIXED: Don't clear user data on refresh - only set session flag
    if (!sessionStorage.getItem("app_initialized")) {
      sessionStorage.setItem("app_initialized", "true");
      console.log("New browser session initialized");
      // Don't automatically clear localStorage here - it causes refresh issues
    }
    setLoading(false);
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Router basename="/coke">
      <NotificationProvider>
        {/* Toast container at the root */}
        <ToastContainer
          position="top-center"
          autoClose={2000}
          hideProgressBar={true}
          closeOnClick
          closeButton={false}
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          style={{ top: "70px" }}
        />

        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-otp" element={<VerifyOTP />} />
          <Route path="/change-password/:uid/:token" element={<ChangePassword />} />

          {/* Protected Routes - All other routes go through this wrapper */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <ProtectedLayout
                  isSidebarOpen={isSidebarOpen}
                  toggleSidebar={toggleSidebar}
                />
              </ProtectedRoute>
            }
          />
        </Routes>
      </NotificationProvider>
    </Router>
  );
}

export default App;