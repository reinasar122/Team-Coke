import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { FaUser, FaLock, FaCog, FaBell } from "react-icons/fa";

function Settings() {
  const [activeTab, setActiveTab] = useState("profile");

  const [user, setUser] = useState({
    username: "",
    email: "",
    full_name: "",
  });

  const [passwords, setPasswords] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [preferences, setPreferences] = useState({
    darkMode: false,
    notifications: true,
  });

  useEffect(() => {
    // Load user info from localStorage or API
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    setUser({
      username: storedUser.username || "",
      email: storedUser.email || "",
      full_name: storedUser.full_name || "",
    });

    // Example: load saved preferences
    setPreferences({
      darkMode: storedUser.darkMode || false,
      notifications: storedUser.notifications ?? true,
    });
  }, []);

  const handleProfileChange = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };

  const handlePreferenceChange = (e) => {
    const { name, checked } = e.target;
    setPreferences({ ...preferences, [name]: checked });
  };

  const updateProfile = async () => {
    try {
      await axios.put(`/api/users/${user.id}/`, user); // adjust API
      toast.success("Profile updated successfully!");
      localStorage.setItem("user", JSON.stringify({ ...user, ...preferences }));
    } catch (error) {
      toast.error("Failed to update profile.");
    }
  };

  const changePassword = async () => {
    if (passwords.new_password !== passwords.confirm_password) {
      toast.error("Passwords do not match.");
      return;
    }
    try {
      await axios.post(`/api/change-password/`, passwords);
      toast.success("Password changed successfully!");
      setPasswords({ current_password: "", new_password: "", confirm_password: "" });
    } catch (error) {
      toast.error("Failed to change password.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Settings</h1>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b">
        <button
          className={`flex items-center px-4 py-2 font-medium ${
            activeTab === "profile" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600"
          }`}
          onClick={() => setActiveTab("profile")}
        >
          <FaUser className="mr-2" /> Profile
        </button>
        <button
          className={`flex items-center px-4 py-2 font-medium ${
            activeTab === "password" ? "border-b-2 border-green-600 text-green-600" : "text-gray-600"
          }`}
          onClick={() => setActiveTab("password")}
        >
          <FaLock className="mr-2" /> Password
        </button>
        <button
          className={`flex items-center px-4 py-2 font-medium ${
            activeTab === "preferences" ? "border-b-2 border-purple-600 text-purple-600" : "text-gray-600"
          }`}
          onClick={() => setActiveTab("preferences")}
        >
          <FaCog className="mr-2" /> Preferences
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white p-6 rounded shadow-md">
        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="space-y-4">
            <input
              type="text"
              name="full_name"
              value={user.full_name}
              onChange={handleProfileChange}
              placeholder="Full Name"
              className="w-full p-3 border rounded focus:ring focus:ring-blue-200"
            />
            <input
              type="text"
              name="username"
              value={user.username}
              onChange={handleProfileChange}
              placeholder="Username"
              className="w-full p-3 border rounded focus:ring focus:ring-blue-200"
            />
            <input
              type="email"
              name="email"
              value={user.email}
              onChange={handleProfileChange}
              placeholder="Email"
              className="w-full p-3 border rounded focus:ring focus:ring-blue-200"
            />
            <button
              onClick={updateProfile}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save Profile
            </button>
          </div>
        )}

        {/* Password Tab */}
        {activeTab === "password" && (
          <div className="space-y-4">
            <input
              type="password"
              name="current_password"
              value={passwords.current_password}
              onChange={handlePasswordChange}
              placeholder="Current Password"
              className="w-full p-3 border rounded focus:ring focus:ring-green-200"
            />
            <input
              type="password"
              name="new_password"
              value={passwords.new_password}
              onChange={handlePasswordChange}
              placeholder="New Password"
              className="w-full p-3 border rounded focus:ring focus:ring-green-200"
            />
            <input
              type="password"
              name="confirm_password"
              value={passwords.confirm_password}
              onChange={handlePasswordChange}
              placeholder="Confirm New Password"
              className="w-full p-3 border rounded focus:ring focus:ring-green-200"
            />
            <button
              onClick={changePassword}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Change Password
            </button>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === "preferences" && (
          <div className="space-y-4">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                name="darkMode"
                checked={preferences.darkMode}
                onChange={handlePreferenceChange}
              />
              <span>Enable Dark Mode</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                name="notifications"
                checked={preferences.notifications}
                onChange={handlePreferenceChange}
              />
              <span>Enable Notifications</span>
            </label>

            <button
              onClick={() => toast.success("Preferences saved!")}
              className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Save Preferences
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;
