import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faUser, faSignOutAlt } from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";
import { Link } from "react-router-dom";

const Header = ({ toggleSidebar }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <header className="bg-gray-900 text-white px-6 py-3 flex justify-between items-center shadow-md fixed w-full top-0 z-10">
      {/* Left - Toggle Button & Logo */}
      <div className="flex items-center">
        <button onClick={toggleSidebar} className="text-xl mr-4 focus:outline-none">
          <FontAwesomeIcon icon={faBars} />
        </button>
        <h1 className="text-xl font-bold">Coke Sales and Inventory System</h1>
      </div>

      {/* Right - Profile Dropdown */}
      <div className="relative">
        <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="focus:outline-none">
          <FontAwesomeIcon icon={faUser} />
        </button>

        {isProfileOpen && (
          <div className="absolute right-0 mt-2 bg-gray-800 shadow-lg rounded w-40">
            <ul className="text-sm">
              <li>
                <Link to="/profile" className="block px-4 py-2 hover:bg-gray-700">Profile</Link>
              </li>
              <li>
                <button className="block w-full text-left px-4 py-2 hover:bg-gray-700 text-red-400">
                  <FontAwesomeIcon icon={faSignOutAlt} className="mr-2" /> Logout
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
