import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
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
import ReservationList from "./pages/ReservationList";
import ReservationDetailPage from "./pages/ReservationDetailPage";
import ReservationSaleDetails from "./pages/ReservationSaleDetails";
import ReservationCancelledDetails from "./pages/ReservationCancelledDetails";
import Merchandising from "./pages/Merchandising";
import MerchandisingSaleDetailPage from "./pages/MerchandisingSaleDetailPage";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyOTP from "./pages/VerifyOTP";
import Expenses from "./pages/Expenses";
import VanLoadReturnRemittance from "./pages/VanLoadReturnRemittance";
import SupplierReturnForm from "./pages/SupplierReturnForm";
import SupplierReturnList from "./pages/SupplierReturnList";
import ReturnEmpties from "./pages/ReturnEmpties";
import WarehouseProductDetails from "./pages/WarehouseProductDetails";
import ReceivingDetails from "./pages/ReceivingDetails";
import VanLoadProductDetails from "./pages/VanLoadProductDetails";
import Settings from "./pages/Settings";
// ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ NEW: Import ExpenseSettings component
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
// ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Customer Registration Component
import CustomerRegistration from './components/merchandisingcomponents/CustomerRegistration';

import {
  FaHome,
  FaClipboardCheck,
  FaChartLine,
  FaFileInvoice,
  FaBoxes,
  FaTruck,
  FaChartPie,
  FaUsers,
  FaUserShield,
  FaWarehouse,
  FaUndoAlt,
  FaChartBar,   // ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ for Sales Report title
  FaMoneyBillWave,
  FaDollarSign, // ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ NEW: for Expense Settings
} from "react-icons/fa";

const DESKTOP_SIDEBAR_BREAKPOINT = 1024;

const getIsDesktopViewport = () => {
  if (typeof window === "undefined") return true;
  return window.innerWidth >= DESKTOP_SIDEBAR_BREAKPOINT;
};

const getStoredUser = () => {
  try {
    const rawUser = localStorage.getItem("user");
    if (!rawUser) return null;

    const parsedUser = JSON.parse(rawUser);
    if (!parsedUser || typeof parsedUser !== "object") return null;
    if (!parsedUser.id) return null;

    return parsedUser;
  } catch (error) {
    return null;
  }
};

const isAdminRole = (role) => {
  const normalizedRole = String(role || "").toLowerCase();
  return ["admin", "administrator", "super admin"].includes(normalizedRole);
};

const isDefaultAdminUser = (user) => {
  const userId = Number(user?.id);
  const phoneNumber = String(user?.phone_number || "").trim();
  return userId === 1 || phoneNumber === "09179902969";
};

const shouldForceMandatoryPasswordChange = (user) => {
  const mustChangePassword = Boolean(
    user?.must_change_password || user?.requires_password_change
  );

  if (!mustChangePassword) return false;
  return isAdminRole(user?.role) && isDefaultAdminUser(user);
};

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const user = getStoredUser();

  if (!user) {
    localStorage.removeItem("user");
    localStorage.removeItem("access");
    localStorage.removeItem("selectedWarehouse");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const requiresPasswordChange = shouldForceMandatoryPasswordChange(user);
  const isOnChangePasswordPage = location.pathname.startsWith("/change-password");

  if (requiresPasswordChange && !isOnChangePasswordPage) {
    return <Navigate to={`/change-password/${user.id}`} replace />;
  }

  return children;
};

// ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Layout wrapper for protected pages
const ProtectedLayout = ({
  isSidebarOpen,
  toggleSidebar,
  closeSidebar,
  isDesktopViewport,
}) => {
  const location = useLocation();
  const hiddenRoutes = [
    "/change-password",
    "/forgot-password",
    "/verify-otp",
    "/login",
  ];
  const hideLayout = hiddenRoutes.includes(location.pathname);

  // Pages where we want to HIDE the universal scrollbar
  const lockPrefixes = ["/vans", "/suppliers", "/trading", "/reservationlist", "/reservation-details", "/reservation-sale-details", "/reservation-cancelled-details"];
  const path = location.pathname.toLowerCase();
  const lockScroll = lockPrefixes.some(p => path === p || path.startsWith(p + "/"));

  return (
    <div className="app-shell flex flex-col h-screen">
      {!hideLayout && <Header toggleSidebar={toggleSidebar} />}
      <div className="flex flex-1">
        {!hideLayout && (
          <>
            {isSidebarOpen && !isDesktopViewport && (
              <button
                type="button"
                aria-label="Close sidebar"
                className="app-shell-sidebar-backdrop fixed inset-x-0 bottom-0 z-20 bg-slate-950/40 backdrop-blur-[1px] lg:hidden"
                onClick={closeSidebar}
              />
            )}
            <Sidebar
              isSidebarOpen={isSidebarOpen}
              onClose={closeSidebar}
              isDesktopViewport={isDesktopViewport}
            />
          </>
        )}

        {/* ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡ app-content + conditional lock */}
        <div
          className={`app-content app-shell-content ${lockScroll ? "lock-scroll" : "allow-page-scroll"} p-3 md:p-5 flex-1 min-w-0 transition-all duration-300 ${
            !hideLayout && isSidebarOpen && isDesktopViewport
              ? "app-shell-content--sidebar-open"
              : "ml-0"
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

                {/* Customer page titles */}
                <Route path="/customers" element={null} />
                <Route path="/customer-registration" element={null} />

                <Route path="/receiving" />
                <Route path="/stocks" />
                <Route path="/products" />
                <Route path="/suppliers" />
                <Route path="/settings" element={null} />

                {/* Forecasting page title */}
                <Route path="/forecasting" element={null} />

                {/* ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ NEW: Expense Settings page title */}
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
                <Route path="/supplier-returns" element={null} />
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
                
                {/*}
                ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Sales Report page title
                <Route
                  path="/reports/sales"
                  element={
                    <h1 className="text-2xl flex items-center gap-2">
                      <FaChartBar /> Sales Report
                    </h1>
                  }
                />
                  `removing duplicate sales report*/}
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

            {/* ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Customer Routes */}
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
            <Route path="/register-supplier" element={<SupplierRegistrationPage />} />
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
            <Route path="/reservationlist" element={<ReservationList />} />
            <Route path="/reservation-details/:id" element={<ReservationDetailPage />} />
            <Route path="/reservation-sale-details/:id" element={<ReservationSaleDetails />} />
            <Route path="/reservation-cancelled-details/:id" element={<ReservationCancelledDetails />} />
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
                <MerchandisingSale />
              }
            />

            <Route path="/merchandising-sale/:id" element={<MerchandisingSaleDetailPage />} />

            {/* Profile & Expenses */}
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/expences" element={<Navigate to="/expenses" replace />} />

            {/* ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ NEW: Expense Settings Route */}
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
            <Route path="/van-load-return-remittance" element={<VanLoadReturnRemittance />} />
            <Route path="/van-load-update" element={<Navigate to="/van-load-return-remittance" replace />} />
            <Route path="/van-load-product-details/:id" element={<VanLoadProductDetails />} />

            {/* Edit Role Access */}
            <Route path="/edit-role-access/:id" element={<EditRoleAccessWrapper />} />

            {/* ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Fallback for unmatched routes - redirect to dashboard if authenticated */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

// ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Main App Component with NotificationProvider
function SupplierRegistrationPage() {
  const navigate = useNavigate();

  return (
    <SupplierRegistrationForm
      onClose={() => navigate("/suppliers", { replace: true })}
    />
  );
}

function App() {
  const [isDesktopViewport, setIsDesktopViewport] = useState(getIsDesktopViewport);
  const [isSidebarOpen, setIsSidebarOpen] = useState(getIsDesktopViewport);
  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const closeSidebar = () => setIsSidebarOpen(false);

  // Loading state to prevent flickering before rendering the page
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ FIXED: Don't clear user data on refresh - only set session flag
    if (!sessionStorage.getItem("app_initialized")) {
      sessionStorage.setItem("app_initialized", "true");
      console.log("New browser session initialized");
      // Don't automatically clear localStorage here - it causes refresh issues
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      `(min-width: ${DESKTOP_SIDEBAR_BREAKPOINT}px)`
    );

    const syncSidebarMode = (matches) => {
      setIsDesktopViewport(matches);
      setIsSidebarOpen(matches);
    };

    syncSidebarMode(mediaQuery.matches);

    const handleChange = (event) => {
      syncSidebarMode(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
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
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-otp" element={<VerifyOTP />} />
          {/* Mandatory password change for default admin (first-time login) */}
          <Route path="/change-password/:id" element={<ChangePassword />} />
          
          {/* Password reset via forgot password (has uid/token) */}
          <Route path="/change-password/:uid/:token" element={<ChangePassword />} />

          
          

          {/* Protected Routes - All other routes go through this wrapper */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <ProtectedLayout
                  isSidebarOpen={isSidebarOpen}
                  toggleSidebar={toggleSidebar}
                  closeSidebar={closeSidebar}
                  isDesktopViewport={isDesktopViewport}
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



