// src/components/Profile.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUser,
  FaEnvelope,
  FaWarehouse,
  FaVenusMars,
  FaUserShield,
  FaSignOutAlt,
} from "react-icons/fa";

const Profile = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // ✅ Get logged-in user from localStorage
        const storedUser = JSON.parse(localStorage.getItem("user"));
        if (!storedUser?.id) {
          throw new Error("No logged-in user found");
        }

        // ✅ Fetch that user’s full data
        const response = await fetch(`http://127.0.0.1:8080/api/users/${storedUser.id}/`);
        if (!response.ok) {
          throw new Error("Failed to fetch user data");
        }

        const data = await response.json();
        setUserData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("access");
    localStorage.removeItem("selectedWarehouse");
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="p-4 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center p-4">{error}</div>;
  }

  return (
    <div className="p-4">
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center mb-3">
        <div className="w-16 h-16 bg-blue-100 flex items-center justify-center rounded-full shadow">
          <FaUser className="text-blue-600 text-2xl" />
        </div>
        <h2 className="mt-2 text-lg font-semibold">
          {userData?.first_name && userData?.last_name
            ? `${userData.first_name} ${userData.last_name}`
            : userData?.username}
        </h2>
        <p className="text-gray-500 text-sm">{userData?.email || "No email"}</p>
      </div>

      {/* Info */}
      <div className="space-y-2 text-sm mb-4">
        <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
          <FaUserShield className="text-blue-500" />
          <span>
            <strong>Role:</strong>{" "}
            {userData?.role?.name || userData?.role_name || "Not set"}
          </span>
        </div>
        <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
          <FaWarehouse className="text-green-500" />
          <span>
            <strong>Warehouse:</strong>{" "}
            {userData?.warehouse?.name || userData?.warehouse_name || "Not set"}
          </span>
        </div>
        {userData?.gender && (
          <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
            <FaVenusMars className="text-pink-500" />
            <span>
              <strong>Gender:</strong> {userData.gender}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
          <FaEnvelope className="text-purple-500" />
          <span>
            <strong>Email:</strong> {userData?.email}
          </span>
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-2 px-4 text-red-600 font-medium bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
      >
        <FaSignOutAlt /> Logout
      </button>
    </div>
  );
};

export default Profile;
