import { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

// Layout Components\
import MerchandisingSale from "./components/merchandisingcomponents/MerchandisingSale";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
// src/index.js or src/main.jsx
import './index.css';

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
import MerchandisingSaleDetailPage from './pages/MerchandisingSaleDetailPage';
import ForgotPassword from "./pages/ForgotPassword";
import VerifyOTP from "./pages/VerifyOTP";
import Expences from "./pages/Expences";
import VanLoadUpdate from "./pages/VanLoadUpdate";
import SupplierReturnForm from "./pages/SupplierReturnForm";
import SupplierReturnList from "./pages/SupplierReturnList";
import ReturnEmpties from "./pages/ReturnEmpties";
import PaymentModal from "./components/PaymentModal";


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
} from "react-icons/fa";

// ✅ Layout wrapper for protected pages
const ProtectedLayout = ({ isSidebarOpen, toggleSidebar }) => {
  const location = useLocation();
  const hiddenRoutes = ["/change-password", "/forgot-password", "/verify-otp", "/login"];
  const hideLayout = hiddenRoutes.includes(location.pathname);

  return (
    <div className="flex flex-col h-screen">
      {!hideLayout && <Header toggleSidebar={toggleSidebar} />}
      <div className="flex flex-1">
        {!hideLayout && <Sidebar isSidebarOpen={isSidebarOpen} />}
        <div
          className={`p-5 flex-1 transition-all duration-300 ${
            !hideLayout && isSidebarOpen ? "ml-64 mt-16" : "ml-0"
          }`}
        >
          {/* Page Titles */}
          {!hideLayout && (
            <div className="page-title mb-4">
              <Routes>
                <Route path="/" element={<h1 className="text-2xl flex items-center gap-2"><FaHome /> Home Page</h1>} />
                <Route path="/dashboard" element={<h1 className="text-2xl flex items-center gap-2"><FaChartPie /> Dashboard</h1>} />
                <Route path="/receiving" element={<h1 className="text-2xl flex items-center gap-2"><FaClipboardCheck /> Receiving</h1>} />
                <Route path="/stocks" element={<h1 className="text-2xl flex items-center gap-2"><FaBoxes /> Stocks</h1>} />
                <Route path="/products" element={<h1 className="text-2xl flex items-center gap-2"><FaBoxes /> Products</h1>} />
                <Route path="/suppliers" element={<h1 className="text-2xl flex items-center gap-2"><FaTruck /> Suppliers</h1>} />
                <Route path="/settings" element={<h1 className="text-2xl flex items-center gap-2"><FaCogs /> Settings</h1>} />
                <Route path="/users" element={<h1 className="text-2xl flex items-center gap-2"><FaUsers /> Users</h1>} />
                <Route path="/roles" element={<h1 className="text-2xl flex items-center gap-2"><FaUserShield /> Roles</h1>} />
                <Route path="/warehouses" element={<h1 className="text-2xl flex items-center gap-2"><FaWarehouse className="text-red-500" /> Warehouses</h1>} />
                <Route path="/trading" element={<h1 className="text-2xl flex items-center gap-2"><FaChartLine /> Trading</h1>} />
                <Route path="/invoice" element={<h1 className="text-2xl flex items-center gap-2"><FaFileInvoice /> Invoice</h1>} />
                <Route path="/StocksAdjustment" element={<h1 className="text-2xl flex items-center gap-2"><FaTruck /> Stocks Adjustment</h1>} />
                <Route path="/supplier-returns" element={<h1 className="text-2xl flex items-center gap-2"><FaTruck /> Supplier Returns</h1>} />
                <Route path="/return-empties" element={<h1 className="text-2xl flex items-center gap-2"><FaUndoAlt /> Return Empties</h1>} />
              </Routes>
            </div>
          )}

          {/* Page Routes */}
          <Routes>
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
            <Route path="/receiving/new" element={<ReceivingForm />} />
            <Route path="/trading" element={<MerchandisingList />} />
            <Route path="/merchandising" element={<><h1 className="text-2xl flex items-center gap-2 mb-4"><FaChartLine /> Create New Sale</h1><Merchandising /></>} />
            <Route path="/merchandising-sale" element={<MerchandisingSale />} />
            <Route path="/merchandising-sale/:id" element={<MerchandisingSaleDetailPage />} />
            <Route path="/edit-role-access/:id" element={<EditRoleAccessWrapper />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/verify-otp" element={<VerifyOTP />} />
            <Route path="/expences" element={<Expences />} />
            <Route path="/van-load-update" element={<VanLoadUpdate />} />


            
          
            <Route path="/supplier-returns" element={<SupplierReturnList />} />
            <Route path="/supplier-returns/new" element={<SupplierReturnForm />} />
            <Route path="/return-empties" element={<ReturnEmpties />} />
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