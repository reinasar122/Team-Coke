import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
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

import ProductForm from './pages/ProductForm';
import ProductEdit from './pages/ProductEdit';
import ProductList from './pages/ProductList';

import VanList from "./pages/VanList";

import ReceivingList from "./pages/ReceivingList";
import ReceivingForm from "./pages/ReceivingForm";


import MerchandisingList from "./pages/MerchandisingList";
import Merchandising from "./pages/Merchandising";
import MerchandisingSale from "./pages/MerchandisingSale";



import { 
  FaHome, FaClipboardCheck, FaChartLine, FaFileInvoice, FaBoxes, 
  FaTruck, FaChartPie, FaCogs, FaUsers, FaUserShield, FaWarehouse 
} 
from "react-icons/fa";


function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <Router>
      <div className="flex flex-col h-screen">
        {/* Header (Always Visible) */}
        <Header toggleSidebar={toggleSidebar} />

        <div className="flex flex-1">
          {/* Sidebar (Toggles) */}
          <Sidebar isSidebarOpen={isSidebarOpen} />

          {/* Main Content */}
          <div className={`p-5 flex-1 transition-all duration-300 mt-16 ${isSidebarOpen ? "ml-64" : "ml-0"}`}>
            {/* Page Title */}
            <div className="page-title mb-4">
            <Routes>
              <Route path="/" element={<h1 className="text-2xl flex items-center gap-2"><FaHome /> Home Page</h1>} />
              <Route path="/receiving" element={<h1 className="text-2xl flex items-center gap-2"><FaClipboardCheck /> Receiving</h1>} />
              <Route path="/trading" element={<h1 className="text-2xl flex items-center gap-2"><FaChartLine /> Trading</h1>} />
              <Route path="/invoice" element={<h1 className="text-2xl flex items-center gap-2"><FaFileInvoice /> Invoice</h1>} />
              <Route path="/stocks" element={<h1 className="text-2xl flex items-center gap-2"><FaBoxes /> Stocks</h1>} />
              <Route path="/StocksAdjustment" element={<h1 className="text-2xl flex items-center gap-2"><FaTruck /> Stocks Adjustment</h1>} /> 
              <Route path="/products" element={<h1 className="text-2xl flex items-center gap-2"><FaBoxes />Products</h1>} />                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           
              <Route path="/suppliers" element={<h1 className="text-2xl flex items-center gap-2"><FaTruck /> Suppliers</h1>} />
              <Route path="/dashboard" element={<h1 className="text-2xl flex items-center gap-2"><FaChartPie /> Dashboard</h1>} />
              <Route path="/settings" element={<h1 className="text-2xl flex items-center gap-2"><FaCogs /> Settings</h1>} />
              <Route path="/users" element={<h1 className="text-2xl flex items-center gap-2"><FaUsers /> Users</h1>} />
              <Route path="/roles" element={<h1 className="text-2xl flex items-center gap-2"><FaUserShield /> Roles</h1>} />
              <Route path="/warehouses" element={<h1 className="text-2xl flex items-center gap-2"><FaWarehouse className="text-red-500" />  Warehouses</h1>} />
              
            </Routes>
            </div>

            {/* Page Content */}
            <Routes>
              <Route path="/warehouses" element={<Warehouses />} />
              <Route path="/warehouseForm" element={<WarehouseForm />} />
              <Route path="/editWarehouse/:id" element={<EditWarehouse />} />
              <Route path="/suppliers" element={<Suppliers />} /> {/* Add this line */}
              <Route path="/register-supplier" element={<SupplierRegistrationForm />} />
              <Route path="/edit-supplier/:id" element={<SupplierEditForm />} />
              <Route path="/Stocks" element={<Stocks />} />
              

              {/* ✅ Add User Routes */}
              <Route path="/users" element={<UserList />} />
              <Route path="/create-user" element={<UserForm />} />

              {/* ✅ Add Role Routes */}
              <Route path="/roles" element={<RoleList />} />
              <Route path="/create-role" element={<RoleForm onClose={() => {}} />} />

              {/* ✅ Add Product Routes */}
              <Route path="/" element={<Navigate/>} />
              <Route path="/products" element={<ProductList />} />
              <Route path="/products/new" element={<ProductForm />} />
              <Route path="/products/:id/edit" element={<ProductEdit />} />

              <Route path="/vans" element={<VanList />} />

              {/* Receiving */}
              <Route path="/receiving" element={<ReceivingList />} />
              <Route path="/receiving/new" element={<ReceivingForm />} />

              {/* Default Redirect */}
              <Route path="/" element={<Navigate to="/dashboard" />} />

              <Route path="/trading" element={<MerchandisingList />} />
              <Route path="/merchandising"element={<><h1 className="text-2xl flex items-center gap-2 mb-4"><FaChartLine /> Create New Sale</h1><Merchandising /></>}/>

              <Route path="/merchandising-sale" element={<MerchandisingSale />} />

            </Routes>
          </div>
          

        </div>
      </div>
    </Router>
  );
}

export default App;
