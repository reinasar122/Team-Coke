import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTachometerAlt,
  faShoppingCart,
  faBoxOpen,
  faCog,
  faSignOutAlt,
  faChevronDown,
  faChevronUp,
  faChartBar,
} from "@fortawesome/free-solid-svg-icons";
import { canView } from "../utils/accessControl";

const Sidebar = ({ isSidebarOpen }) => {
  const [openDropdown, setOpenDropdown] = useState(null);
  const navigate = useNavigate(); // ✅ added

  const toggleDropdown = (menu) => {
    setOpenDropdown(openDropdown === menu ? null : menu);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("access");
    localStorage.removeItem("resetEmail");
    navigate("/login");
  };

  const DisabledItem = ({ icon, text }) => (
    <div className="p-2 rounded flex items-center text-gray-500 cursor-not-allowed opacity-50">
      <FontAwesomeIcon icon={icon} className="mr-2" />
      {text}
    </div>
  );

  const DisabledSubItem = ({ text }) => (
    <div className="block p-2 text-sm text-gray-400 rounded cursor-not-allowed opacity-50">
      {text}
    </div>
  );

  return (
    <div className={`bg-gray-900 text-white w-64 h-screen p-5 fixed top-12 left-0 transition-transform duration-300 ${isSidebarOpen ? "translate-x-0" : "-translate-x-64"}`}>
      <ul className="space-y-3">
        {/* Dashboard */}
        <li>
          {canView("Dashboard") ? (
            <Link to="/" className="p-2 hover:bg-gray-700 rounded flex items-center">
              <FontAwesomeIcon icon={faTachometerAlt} className="mr-2" /> Dashboard
            </Link>
          ) : (
            <DisabledItem icon={faTachometerAlt} text="Dashboard" />
          )}
        </li>

        {/* Transactions */}
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
              {canView("Receiving") ? (
                <li><Link to="/receiving" className="block p-2 text-sm hover:bg-gray-600 rounded">Receiving</Link></li>
              ) : (
                <DisabledSubItem text="Receiving" />
              )}
              {canView("Trading") ? (
                <li><Link to="/trading" className="block p-2 text-sm hover:bg-gray-600 rounded">Trading</Link></li>
              ) : (
                <DisabledSubItem text="Trading" />
              )}
              {canView("Supplier Return") ? (
                <li><Link to="/supplier-returns" className="block p-2 text-sm hover:bg-gray-600 rounded">Supplier Return</Link></li>
              ) : (
                <DisabledSubItem text="Supplier Return" />
              )}
              {canView("Invoice") ? (
                <li><Link to="/invoice" className="block p-2 text-sm hover:bg-gray-600 rounded">Invoice</Link></li>
              ) : (
                <DisabledSubItem text="Invoice" />
              )}
            </ul>
          )}

        </li>

        {/* Inventory */}
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
              {canView("Stocks") ? (
                <li><Link to="/stocks" className="block p-2 text-sm hover:bg-gray-600 rounded">Stocks</Link></li>
              ) : (
                <DisabledSubItem text="Stocks" />
              )}
              {canView("Product") ? (
                <li><Link to="/products" className="block p-2 text-sm hover:bg-gray-600 rounded">Product</Link></li>
              ) : (
                <DisabledSubItem text="Product" />
              )}
              {canView("Returned Empties") ? (
                <li><Link to="/return-empties" className="block p-2 text-sm hover:bg-gray-600 rounded">Return Empties</Link></li>
              ) : (
                <DisabledSubItem text="Return Empties" />
              )}
            </ul>
          )}
        </li>

        {/* Reports */}
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
              {canView("Sales Report") ? (
                <li><Link to="/salesreport" className="block p-2 text-sm hover:bg-gray-600 rounded">Sales Report</Link></li>
              ) : (
                <DisabledSubItem text="Sales Report" />
              )}
              {canView("Inventory Report") ? (
                <li><Link to="/inventoryreport" className="block p-2 text-sm hover:bg-gray-600 rounded">Inventory Report</Link></li>
              ) : (
                <DisabledSubItem text="Inventory Report" />
              )}
            </ul>
          )}
        </li>

        {/* Manage */}
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
              {canView("User") ? (
                <li><Link to="/users" className="block p-2 text-sm hover:bg-gray-600 rounded">Users</Link></li>
              ) : (
                <DisabledSubItem text="Users" />
              )}
              {canView("Roles") ? (
                <li><Link to="/roles" className="block p-2 text-sm hover:bg-gray-600 rounded">Roles</Link></li>
              ) : (
                <DisabledSubItem text="Roles" />
              )}
              {canView("Warehouse") ? (
                <li><Link to="/warehouses" className="block p-2 text-sm hover:bg-gray-600 rounded">Warehouses</Link></li>
              ) : (
                <DisabledSubItem text="Warehouses" />
              )}
              {canView("Supplier") ? (
                <li><Link to="/suppliers" className="block p-2 text-sm hover:bg-gray-600 rounded">Suppliers</Link></li>
              ) : (
                <DisabledSubItem text="Suppliers" />
              )}
              {canView("Van") ? (
                <li><Link to="/vans" className="block p-2 text-sm hover:bg-gray-600 rounded">Van</Link></li>
              ) : (
                <DisabledSubItem text="Van" />
              )}
            </ul>
          )}
        </li>

        {/* Settings */}
        <li>
          {canView("Settings") ? (
            <Link to="/settings" className="block p-2 hover:bg-gray-700 rounded flex items-center">
              <FontAwesomeIcon icon={faCog} className="mr-2" /> Settings
            </Link>
          ) : (
            <DisabledItem icon={faCog} text="Settings" />
          )}
        </li>

        {/* Logout */}
        <li>
          <button
            onClick={handleLogout}
            className="w-full text-left p-2 text-red-400 hover:bg-red-700 rounded flex items-center"
          >
            <FontAwesomeIcon icon={faSignOutAlt} className="mr-2" /> Log out
          </button>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;