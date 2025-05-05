import { useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTachometerAlt, faShoppingCart, faBoxOpen, faCog, faSignOutAlt, faChevronDown, faChartBar, faChevronUp } from "@fortawesome/free-solid-svg-icons";

const Sidebar = ({ isSidebarOpen }) => {
  const [openDropdown, setOpenDropdown] = useState(null);

  const toggleDropdown = (menu) => {
    setOpenDropdown(openDropdown === menu ? null : menu);
  };

  return (
    <div className={`bg-gray-900 text-white w-64 h-screen p-5 fixed top-12 left-0 transition-transform duration-300 ${isSidebarOpen ? "translate-x-0" : "-translate-x-64"}`}>
      <ul className="space-y-3">
        <li>
          <Link to="/" className="p-2 hover:bg-gray-700 rounded flex items-center">
            <FontAwesomeIcon icon={faTachometerAlt} className="mr-2" /> Dashboard
          </Link>
        </li>

        {/* Transactions Dropdown */}
        <li>
          <button 
            onClick={() => toggleDropdown("transactions")} 
            className="w-full text-left p-2 hover:bg-gray-700 rounded flex items-center justify-between"
          >
            <span>
              <FontAwesomeIcon icon={faShoppingCart} className="mr-2" /> Transactions
            </span>
            <FontAwesomeIcon icon={openDropdown === "transactions" ? faChevronUp : faChevronDown} />
          </button>
          {openDropdown === "transactions" && (
            <ul className="ml-4 mt-2 space-y-2">
              <li><Link to="/receiving" className="block p-2 text-sm hover:bg-gray-600 rounded">Receiving</Link></li>
              <li><Link to="/trading" className="block p-2 text-sm hover:bg-gray-600 rounded">Trading</Link></li>
              <li><Link to="/supplier_return" className="block p-2 text-sm hover:bg-gray-600 rounded">Supplier Return</Link></li>
            </ul>
          )}
        </li>

        {/* Inventory Dropdown */}
        <li>
          <button 
            onClick={() => toggleDropdown("inventory")} 
            className="block w-full text-left p-2 hover:bg-gray-700 rounded flex items-center justify-between"
          >
            <span>
              <FontAwesomeIcon icon={faBoxOpen} className="mr-2" /> Inventory
            </span>
            <FontAwesomeIcon icon={openDropdown === "inventory" ? faChevronUp : faChevronDown} />
          </button>
          {openDropdown === "inventory" && (
            <ul className="ml-4 mt-2 space-y-2">
              <li><Link to="/stocks" className="block p-2 text-sm hover:bg-gray-600 rounded">Stocks</Link></li>
              <li><Link to="/products" className="block p-2 text-sm hover:bg-gray-600 rounded">Product</Link></li>
            </ul>
          )}
        </li>


       {/* Report Dropdown */}
       <li>
          <button 
            onClick={() => toggleDropdown("report")} 
            className="block w-full text-left p-2 hover:bg-gray-700 rounded flex items-center justify-between"
          >
            <span>
              <FontAwesomeIcon icon={faChartBar} className="mr-2" /> Report
            </span>
            <FontAwesomeIcon icon={openDropdown === "report" ? faChevronUp : faChevronDown} />
          </button>
          {openDropdown === "report" && (
            <ul className="ml-4 mt-2 space-y-2">
              <li><Link to="/salesreport" className="block p-2 text-sm hover:bg-gray-600 rounded">Sales Report</Link></li>
              <li><Link to="/inventoryreport" className="block p-2 text-sm hover:bg-gray-600 rounded">Inventory Report</Link></li>
            </ul>
          )}
        </li>


        <li>
          <button 
            onClick={() => toggleDropdown("manage")} 
            className="block w-full text-left p-2 hover:bg-gray-700 rounded flex items-center justify-between"
          >
            <span>
              <FontAwesomeIcon icon={faBoxOpen} className="mr-2" /> Manage
            </span>
            <FontAwesomeIcon icon={openDropdown === "manage" ? faChevronUp : faChevronDown} />
          </button>
          {openDropdown === "manage" && (
            <ul className="ml-4 mt-2 space-y-2">
              <li><Link to="/users" className="block p-2 text-sm hover:bg-gray-600 rounded">Users</Link></li>
              <li><Link to="/roles" className="block p-2 text-sm hover:bg-gray-600 rounded">Roles</Link></li>
              <li><Link to="/warehouses" className="block p-2 text-sm hover:bg-gray-600 rounded">Warehouses</Link></li>
              <li><Link to="/suppliers" className="block p-2 text-sm hover:bg-gray-600 rounded">Suppliers</Link></li>
              <li><Link to="/vans" className="block p-2 text-sm hover:bg-gray-600 rounded">Van</Link></li>
            </ul>
          )}
        </li>

        {/* Settings */}
        <li>
          <Link to="/settings" className="block p-2 hover:bg-gray-700 rounded flex items-center">
            <FontAwesomeIcon icon={faCog} className="mr-2" /> Settings
          </Link>
        </li>

        {/* Logout */}
        <li>
          <button className="w-full text-left p-2 text-red-400 hover:bg-red-700 rounded flex items-center">
            <FontAwesomeIcon icon={faSignOutAlt} className="mr-2" /> Log out
          </button>
        </li>

      </ul>
    </div>
  );
};

export default Sidebar;
