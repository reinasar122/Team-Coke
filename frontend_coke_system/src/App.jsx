import { useState } from "react";
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
import './styles/global.scss';

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
import { FaUser } from "react-icons/fa";
// Karen Changes
import VanLoadProductDetails from "./pages/VanLoadProductDetails";

// Dashboard Page
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
// ✅ Sales Report
import SalesReport from "./pages/reports/SalesReport.jsx";

// Credits
import CreditList from "./pages/CreditList";
import CreditDetail from "./pages/CreditDetail";

import Invoice from "./pages/Invoice";




// Icons
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

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// ✅ Layout wrapper for protected pages
const ProtectedLayout = ({ isSidebarOpen, toggleSidebar }) => {
  const location = useLocation();
  const hiddenRoutes = ["/change-password", "/forgot-password", "/verify-otp", "/login"];
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
                       Home Page
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
                <Route
                  path="/receiving"
                  // element={
                  //   <h1 className="text-2xl flex items-center">
                  //     <FaClipboardCheck /> Receiving
                  //   </h1>
                  // }
                />
                <Route path="/stocks" />
                <Route path="/products" />
                <Route
                  path="/suppliers"
                  // element={
                  //   <h1 className="text-2xl flex items-center gap-2">
                  //     <FaTruck /> Suppliers
                  //   </h1>
                  // }
                />
                <Route
                  path="/settings"
                  element={
                    <h1 className="text-2xl flex items-center gap-2">
                      <FaCogs /> Settings
                    </h1>
                  }
                />
                {/*<Route
                  path="/users"
                  // element={
                  //   <h1 className="text-2xl flex items-center gap-2">
                  //     <FaUsers /> Users
                  //   </h1>
                  // }
                />
                <Route
                  path="/roles"
                  element={
                    <h1 className="text-2xl flex items-center gap-2">
                      <FaUserShield /> Roles
                    </h1>
                  }
                />
                <Route
                  path="/warehouses"
                  element={
                    <h1 className="text-2xl flex items-center gap-2">
                      <FaWarehouse className="text-red-500" /> Warehouses
                    </h1>
                  }
                />*/}
                <Route
                    path="/profile"
                    // element={
                    //   <h1 className="text-2xl flex items-center gap-2">
                    //     <FaUser /> Profile
                    //   </h1>
                    // }
                  />
                <Route
                  path="/invoice"
                  element={
                    <h1 className="text-2xl flex items-center gap-2">
                      <FaFileInvoice /> Invoice
                    </h1>
                  }
                />
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
                    <h1 className="text-2xl flex items-center gap-2">
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

                 <Route
                  path="/profile"
                  // element={
                  //   <h1 className="text-2xl flex items-center gap-2">
                  //     <FaUser /> Profile
                  //   </h1>
                  // }
                />

                <Route
                  path="/expenses"
                  // element={
                  //   <h1 className="text-2xl flex items-center gap-2">
                  //     <FaMoneyBillWave /> Expenses
                  //   </h1>
                  // }
                />
              </Routes>
            </div>
          )}

          {/* Page Routes */}
          <Routes>
            {/* Dashboard */}
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Credits */}
            <Route path="/credits" element={<CreditList />} />
            <Route path="/credit" element={<Navigate to="/credits" replace />} />
            <Route path="/credits/:id" element={<CreditDetail />} />

            {/* Default / Others */}
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/warehouses" element={<Warehouses />} />
            <Route path="/warehouseForm" element={<WarehouseForm />} />
            <Route path="/editWarehouse/:id" element={<EditWarehouse />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/register-supplier" element={<SupplierRegistrationForm />} />
            <Route path="/edit-supplier/:id" element={<SupplierEditForm />} />
            <Route path="/stocks" element={<Stocks />} />
            <Route path="/users" element={<UserList />} />
            <Route path="/create-user" element={<UserForm />} />
            <Route path="/roles" element={<RoleList />} />
            <Route path="/create-role" element={<RoleForm onClose={() => {}} />} />
            <Route path="/products" element={<ProductList />} />
            <Route path="/products/new" element={<ProductForm />} />
            <Route path="/products/:id/edit" element={<ProductEdit />} />
            <Route path="/vans" element={<VanList />} />
            <Route path="/receiving" element={<ReceivingList />} />
            <Route path="/receiving/:id" element={<ReceivingDetails />} />
            <Route path="/receiving/new" element={<ReceivingForm />} />
            <Route path="/trading" element={<MerchandisingList />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/expences" element={<Navigate to="/expenses" replace />} />  

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
            <Route path="/merchandising-sale" element={<MerchandisingSale />} />
            <Route path="/merchandising-sale/:id" element={<MerchandisingSaleDetailPage />} />
            <Route path="/warehouse-details/:mspNo" element={<WarehouseProductDetails />} />

            <Route path="/edit-role-access/:id" element={<EditRoleAccessWrapper />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/verify-otp" element={<VerifyOTP />} />
            <Route path="/expences" element={<Navigate to="/expenses" replace />} />

            <Route path="/invoice" element={<Invoice />} />      

            {/* Karen Changes */}
            <Route path="/van-load-update" element={<VanLoadUpdate />} />
            <Route path="/van-load-product-details/:id" element={<VanLoadProductDetails />} />
            <Route path="/supplier-returns" element={<SupplierReturnList />} />
            <Route path="/supplier-returns/new" element={<SupplierReturnForm />} />
            <Route path="/return-empties" element={<ReturnEmpties />} />

            {/* ✅ Sales Report page route */}
            <Route path="/reports/sales" element={<SalesReport />} />
            <Route path="/salesreport" element={<Navigate to="/reports/sales" replace />} />

           



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

  return (
    <Router>

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
          style={{ top: '70px' }}
        />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />
        <Route path="/change-password" element={<ChangePassword />} />

        {/* Protected Layout */}
        <Route
          path="/*"
          element={
            <ProtectedLayout
              isSidebarOpen={isSidebarOpen}
              toggleSidebar={toggleSidebar}
            />
          }
        />
      </Routes>
    </Router>
  );
}

export default App;