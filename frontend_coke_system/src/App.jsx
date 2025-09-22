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
} from "react-icons/fa";


// ✅ Check if user is logged in
const isAuthenticated = () => {
  return localStorage.getItem("user") !== null;
};

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user"));

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

  return (
    <div className="flex flex-col h-screen">
      {!hideLayout && <Header toggleSidebar={toggleSidebar} />}
      <div className="flex flex-1">
        {!hideLayout && <Sidebar isSidebarOpen={isSidebarOpen} />}

        <div
          className={`app-content p-5 flex-1 transition-all duration-300 ${
            !hideLayout && isSidebarOpen ? "ml-64 pt-16" : "ml-0"
          }`}
        >
          <Routes>
            {/* Dashboard */}
            <Route path="/dashboard" element={<Dashboard />} />

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
            <Route path="/merchandising" element={<Merchandising />} />
            <Route path="/merchandising-sale" element={<MerchandisingSale />} />
            <Route path="/merchandising-sale/:id" element={<MerchandisingSaleDetailPage />} />

            {/* Profile & Expenses */}
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/expenses" element={<Expenses />} />

            {/* Supplier Returns */}
            <Route path="/supplier-returns" element={<SupplierReturnList />} />
            <Route path="/supplier-returns/new" element={<SupplierReturnForm />} />
            <Route path="/return-empties" element={<ReturnEmpties />} />

            {/* Sales Report */}
            <Route path="/reports/sales" element={<SalesReport />} />

            {/* Warehouse Details */}
            <Route path="/warehouse-details/:mspNo" element={<WarehouseProductDetails />} />

            {/* Van Load */}
            <Route path="/van-load-update" element={<VanLoadUpdate />} />
            <Route path="/van-load-product-details/:id" element={<VanLoadProductDetails />} />

            {/* Edit Role Access */}
            <Route path="/edit-role-access/:id" element={<EditRoleAccessWrapper />} />

            {/* ✅ Default Fallback */}
            <Route
              path="*"
              element={
                <Navigate to={isAuthenticated() ? "/dashboard" : "/login"} replace />
              }
            />
          </Routes>
        </div>
      </div>
    </div>
  );
};

// ✅ Main App Component
function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Loading state to prevent flickering before rendering the page
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      // Check if this browser session has been initialized
      if (!sessionStorage.getItem("app_initialized")) {
        // First load after yarn start → clear old user session
        localStorage.removeItem("user");
        sessionStorage.setItem("app_initialized", "true");
      }
      setLoading(false);
    }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
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

        {/* Protected Routes */}
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

        {/* Default Redirect to Login if not authenticated */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
