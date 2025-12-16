import { useState, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
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
  faChartLine,
} from "@fortawesome/free-solid-svg-icons";
import { hasAccess } from "../utils/accessUtils"; // Import the new permission check functions
import { canView } from "../utils/accessControl";
import { routeMap, routeOrder } from "../utils/routeMap"; // Import route map

const Sidebar = ({ isSidebarOpen }) => {
  const [openDropdown, setOpenDropdown] = useState(null);
  const [accessibleRoutes, setAccessibleRoutes] = useState([]); // Store accessible routes here
  const navigate = useNavigate();

  // Fetch accessible routes from localStorage or state whenever it changes
  useEffect(() => {
    const accessList = JSON.parse(localStorage.getItem("access") || "[]");
    const allowedRoutes = routeOrder.filter((submenu) => hasAccess(submenu)); // Get accessible submenus
    setAccessibleRoutes(allowedRoutes); // Update the accessible routes state
  }, []); // Empty dependency array to run only once when the component is mounted

  // Redirect user to the first available route they have access to when the sidebar loads
  useEffect(() => {
    const accessibleRoute = getAccessibleRoute();
    if (accessibleRoute) {
      navigate(accessibleRoute);
    } else {
      navigate("/no-access");
    }
  }, [accessibleRoutes]); // Re-run when accessibleRoutes change

  // Function to toggle the dropdown menu
  const toggleDropdown = (menu) => {
    setOpenDropdown(openDropdown === menu ? null : menu);
  };

  // Handle logout logic
  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("access");
    localStorage.removeItem("resetEmail");
    navigate("/login");
  };

  // Determine the first accessible route based on user permissions
  const getAccessibleRoute = () => {
    if (accessibleRoutes.length > 0) {
      // If there are accessible routes, return the first one
      return routeMap[accessibleRoutes[0]];
    }
    return null; // If no accessible route is found, return null (no access)
  };

  // Use canView as the primary permission check (or hasAccess if you prefer)
  const checkAccess = (permission) => {
    // You can use either canView or hasAccess, or combine both
    return canView(permission) || hasAccess(permission);
  };

  // Disabled item to show when a submenu is not accessible
  const DisabledItem = ({ icon, text }) => (
    <div className="p-2 rounded flex items-center text-gray-500 cursor-not-allowed opacity-50">
      <FontAwesomeIcon icon={icon} className="mr-2" />
      {text}
    </div>
  );

  // Disabled sub-item for dropdown menus
  const DisabledSubItem = ({ text }) => (
    <div className="block p-2 text-sm text-gray-400 rounded cursor-not-allowed opacity-50">
      {text}
    </div>
  );

  const user = JSON.parse(localStorage.getItem("user"));
  const roleName =
  user?.role_name ||
  user?.role?.name ||
  user?.role ||
  "";

  const isAdmin = roleName.toLowerCase() === "admin";

  return (
    <div className={`bg-gray-900 text-white w-64 h-screen p-5 fixed top-12 left-0 transition-transform duration-300 ${isSidebarOpen ? "translate-x-0" : "-translate-x-64"}`}>
      <ul className="space-y-3">
        {/* Dashboard */}
        <li>
          {checkAccess("Dashboard") ? (
            <NavLink
              to="/"
              className={({ isActive }) =>
                `p-2 hover:bg-gray-700 rounded flex items-center ${
                  isActive ? "bg-gray-800" : ""
                }`
              }
            >
              <FontAwesomeIcon icon={faTachometerAlt} className="mr-2" /> Dashboard
            </NavLink>
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
              {checkAccess("Receiving") ? (
                <li>
                  <NavLink
                    to="/receiving"
                    className={({ isActive }) =>
                      `block p-2 text-sm rounded hover:bg-gray-600 ${
                        isActive ? "bg-gray-700" : ""
                      }`
                    }
                  >
                    Receiving
                  </NavLink>
                </li>
              ) : (
                <DisabledSubItem text="Receiving" />
              )}
              {checkAccess("Trading") ? (
                <li>
                  <NavLink
                    to="/trading"
                    className={({ isActive }) =>
                      `block p-2 text-sm rounded hover:bg-gray-600 ${
                        isActive ? "bg-gray-700" : ""
                      }`
                    }
                  >
                    Trading
                  </NavLink>
                </li>
              ) : (
                <DisabledSubItem text="Trading" />
              )}
              {checkAccess("Supplier Return") ? (
                <li>
                  <NavLink
                    to="/supplier-returns"
                    className={({ isActive }) =>
                      `block p-2 text-sm rounded hover:bg-gray-600 ${
                        isActive ? "bg-gray-700" : ""
                      }`
                    }
                  >
                    Supplier Return
                  </NavLink>
                </li>
              ) : (
                <DisabledSubItem text="Supplier Return" />
              )}
              {checkAccess("Invoice") ? (
                <li>
                  <NavLink
                    to="/invoice"
                    className={({ isActive }) =>
                      `block p-2 text-sm rounded hover:bg-gray-600 ${
                        isActive ? "bg-gray-700" : ""
                      }`
                    }
                  >
                    Invoice
                  </NavLink>
                </li>
              ) : (
                <DisabledSubItem text="Invoice" />
              )}
              {checkAccess("Credit") ? (
                <li>
                  <NavLink
                    to="/credits"
                    className={({ isActive }) =>
                      `block p-2 text-sm rounded hover:bg-gray-600 ${
                        isActive ? "bg-gray-700" : ""
                      }`
                    }
                  >
                    Credit
                  </NavLink>
                </li>
              ) : (
                <DisabledSubItem text="Credit" />
              )}
              {checkAccess("Expenses") ? (
                <li>
                  <NavLink
                    to="/expenses"
                    className={({ isActive }) =>
                      `block p-2 text-sm rounded hover:bg-gray-600 ${
                        isActive ? "bg-gray-700" : ""
                      }`
                    }
                  >
                    Expenses
                  </NavLink>
                </li>
              ) : (
                <DisabledSubItem text="Expenses" />
              )}
            </ul>
          )}
        </li>

        {/* Inventory */}
        <li>
          <button
            onClick={() => toggleDropdown("inventory")}
            className="w-full text-left p-2 hover:bg-gray-700 rounded flex items-center justify-between"
          >
            <span>
              <FontAwesomeIcon icon={faBoxOpen} className="mr-2" /> Inventory
            </span>
            <FontAwesomeIcon icon={openDropdown === "inventory" ? faChevronUp : faChevronDown} />
          </button>
          {openDropdown === "inventory" && (
            <ul className="ml-4 mt-2 space-y-2">
              {checkAccess("Stocks") ? (
                <li>
                  <NavLink
                    to="/stocks"
                    className={({ isActive }) =>
                      `block p-2 text-sm rounded hover:bg-gray-600 ${
                        isActive ? "bg-gray-700" : ""
                      }`
                    }
                  >
                    Stocks
                  </NavLink>
                </li>
              ) : (
                <DisabledSubItem text="Stocks" />
              )}
              {checkAccess("Product") ? (
                <li>
                  <NavLink
                    to="/products"
                    className={({ isActive }) =>
                      `block p-2 text-sm rounded hover:bg-gray-600 ${
                        isActive ? "bg-gray-700" : ""
                      }`
                    }
                  >
                    Product
                  </NavLink>
                </li>
              ) : (
                <DisabledSubItem text="Product" />
              )}
              {checkAccess("Returned Empties") ? (
                <li>
                  <NavLink
                    to="/return-empties"
                    className={({ isActive }) =>
                      `block p-2 text-sm rounded hover:bg-gray-600 ${
                        isActive ? "bg-gray-700" : ""
                      }`
                    }
                  >
                    Return Empties
                  </NavLink>
                </li>
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
            className="w-full text-left p-2 hover:bg-gray-700 rounded flex items-center justify-between"
          >
            <span>
              <FontAwesomeIcon icon={faChartBar} className="mr-2" /> Report
            </span>
            <FontAwesomeIcon icon={openDropdown === "report" ? faChevronUp : faChevronDown} />
          </button>
          {openDropdown === "report" && (
            <ul className="ml-4 mt-2 space-y-2">
              {checkAccess("Sales Report") ? (
                <li>
                  <NavLink
                    to="/reports/sales"
                    className={({ isActive }) =>
                      `block p-2 text-sm rounded hover:bg-gray-600 ${
                        isActive ? "bg-gray-700" : ""
                      }`
                    }
                  >
                    Sales Report
                  </NavLink>
                </li>
              ) : (
                <DisabledSubItem text="Sales Report" />
              )}
              {/* Uncomment and update if you add Inventory Report route */}
              {/*
              {checkAccess("Inventory Report") ? (
                <li>
                  <NavLink
                    to="/reports/inventory"
                    className={({ isActive }) =>
                      `block p-2 text-sm rounded hover:bg-gray-600 ${
                        isActive ? "bg-gray-700" : ""
                      }`
                    }
                  >
                    Inventory Report
                  </NavLink>
                </li>
              ) : (
                <DisabledSubItem text="Inventory Report" />
              )}
              */}
            </ul>
          )}
        </li>

        {/* Manage */}
        <li>
          <button
            onClick={() => toggleDropdown("manage")}
            className="w-full text-left p-2 hover:bg-gray-700 rounded flex items-center justify-between"
          >
            <span>
              <FontAwesomeIcon icon={faBoxOpen} className="mr-2" /> Manage
            </span>
            <FontAwesomeIcon icon={openDropdown === "manage" ? faChevronUp : faChevronDown} />
          </button>
          {openDropdown === "manage" && (
            <ul className="ml-4 mt-2 space-y-2">
              {checkAccess("User") ? (
                <li>
                  <NavLink
                    to="/users"
                    className={({ isActive }) =>
                      `block p-2 text-sm rounded hover:bg-gray-600 ${
                        isActive ? "bg-gray-700" : ""
                      }`
                    }
                  >
                    Users
                  </NavLink>
                </li>
              ) : (
                <DisabledSubItem text="Users" />
              )}
              {checkAccess("Roles") ? (
                <li>
                  <NavLink
                    to="/roles"
                    className={({ isActive }) =>
                      `block p-2 text-sm rounded hover:bg-gray-600 ${
                        isActive ? "bg-gray-700" : ""
                      }`
                    }
                  >
                    Roles
                  </NavLink>
                </li>
              ) : (
                <DisabledSubItem text="Roles" />
              )}
              {checkAccess("Warehouse") ? (
                <li>
                  <NavLink
                    to="/warehouses"
                    className={({ isActive }) =>
                      `block p-2 text-sm rounded hover:bg-gray-600 ${
                        isActive ? "bg-gray-700" : ""
                      }`
                    }
                  >
                    Warehouses
                  </NavLink>
                </li>
              ) : (
                <DisabledSubItem text="Warehouses" />
              )}
              {checkAccess("Supplier") ? (
                <li>
                  <NavLink
                    to="/suppliers"
                    className={({ isActive }) =>
                      `block p-2 text-sm rounded hover:bg-gray-600 ${
                        isActive ? "bg-gray-700" : ""
                      }`
                    }
                  >
                    Suppliers
                  </NavLink>
                </li>
              ) : (
                <DisabledSubItem text="Suppliers" />
              )}
              {checkAccess("Van") ? (
                <li>
                  <NavLink
                    to="/vans"
                    className={({ isActive }) =>
                      `block p-2 text-sm rounded hover:bg-gray-600 ${
                        isActive ? "bg-gray-700" : ""
                      }`
                    }
                  >
                    Van
                  </NavLink>
                </li>
              ) : (
                <DisabledSubItem text="Van" />
              )}
              {checkAccess("Customer") ? (
                <li>
                  <NavLink
                    to="/customer-registration"
                    className={({ isActive }) =>
                      `block p-2 text-sm rounded hover:bg-gray-600 ${
                        isActive ? "bg-gray-700" : ""
                      }`
                    }
                  >
                    Customers
                  </NavLink>
                </li>
              ) : (
                <DisabledSubItem text="Customers" />
              )}
            </ul>
          )}
        </li>

        {/* Settings */}
        <li>
          {checkAccess("Settings") ? (
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `p-2 hover:bg-gray-700 rounded flex items-center ${
                  isActive ? "bg-gray-800" : ""
                }`
              }
            >
              <FontAwesomeIcon icon={faCog} className="mr-2" /> Settings
            </NavLink>
          ) : (
            <DisabledItem icon={faCog} text="Settings" />
          )}
        </li>

        {/* Forecasting - always enabled */}
        <li>
          {isAdmin && ( 
            <NavLink
              to="/forecasting"
              className={({ isActive }) =>
                `p-2 hover:bg-gray-700 rounded flex items-center ${
                  isActive ? "bg-gray-800" : ""
                }`
              }
            >
              <FontAwesomeIcon icon={faChartLine} className="mr-2" /> Forecasting
            </NavLink>
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