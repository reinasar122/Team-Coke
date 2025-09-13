import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaUser, FaEnvelope, FaWarehouse, FaVenusMars, FaUserShield } from "react-icons/fa";

const Profile = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {
      navigate("/login");
    } else {
      const fetchUserData = async () => {
        try {
          const response = await fetch("http://127.0.0.1:8080/api/users/");
          if (!response.ok) {
            throw new Error("Failed to fetch user data");
          }

          const data = await response.json();
          setUserData(data[0]); // adjust if API returns differently
        } catch (err) {
          setError("Failed to load user data. " + err.message);
        } finally {
          setLoading(false);
        }
      };

      fetchUserData();
    }
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center mt-6">{error}</div>;
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 p-6">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md">
        {/* Profile Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-24 h-24 bg-blue-100 flex items-center justify-center rounded-full shadow-md">
            <FaUser className="text-blue-600 text-4xl" />
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-gray-800">
            {userData?.first_name} {userData?.last_name}
          </h2>
          <p className="text-gray-500">{userData?.email}</p>
        </div>

        {/* User Info Card */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg">
            <FaUserShield className="text-blue-500" />
            <span className="text-gray-700">
              <strong>Role:</strong> {userData?.role_name}
            </span>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg">
            <FaWarehouse className="text-green-500" />
            <span className="text-gray-700">
              <strong>Warehouse:</strong> {userData?.warehouse_name}
            </span>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg">
            <FaVenusMars className="text-pink-500" />
            <span className="text-gray-700">
              <strong>Gender:</strong> {userData?.gender}
            </span>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg">
            <FaEnvelope className="text-purple-500" />
            <span className="text-gray-700">
              <strong>Email:</strong> {userData?.email}
            </span>
          </div>
        </div>
        </div>
    </div>
  );
};

export default Profile;
