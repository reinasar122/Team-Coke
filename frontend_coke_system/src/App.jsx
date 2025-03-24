import { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Warehouses from "./pages/Warehouses"; // Import Warehouses Page

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
                <Route path="/" element={<h1 className="text-2xl">Home Page</h1>} />
                <Route path="/sales" element={<h1 className="text-2xl">Sales</h1>} />
                <Route path="/purchases" element={<h1 className="text-2xl">Purchases</h1>} />
                <Route path="/stock" element={<h1 className="text-2xl">Stock</h1>} />
                <Route path="/suppliers" element={<h1 className="text-2xl">Suppliers</h1>} />
                <Route path="/dashboard" element={<h1 className="text-2xl">Dashboard</h1>} />
                <Route path="/settings" element={<h1 className="text-2xl">Settings</h1>} />
                <Route path="/users" element={<h1 className="text-2xl">Users</h1>} />
                <Route path="/roles" element={<h1 className="text-2xl">Roles</h1>} />
                <Route path="/warehouses" element={<h1 className="text-2xl">Warehouses</h1>} />
              </Routes>
            </div>

            {/* Page Content */}
            <Routes>
              <Route path="/warehouses" element={<Warehouses />} />
            </Routes>
          </div>
          

        </div>
      </div>
    </Router>
  );
}

export default App;
