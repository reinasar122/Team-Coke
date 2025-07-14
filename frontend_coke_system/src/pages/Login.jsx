import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const navigate = useNavigate();

  // Fetch warehouses from API
  const fetchWarehouses = async () => {
    setLoadingWarehouses(true);
    try {
      const res = await axios.get("http://localhost:8080/api/warehouses/");
      setWarehouses(res.data);
    } catch (err) {
      console.error("Failed to fetch warehouses:", err);
      setError("Failed to load warehouses. Please try again.");
    } finally {
      setLoadingWarehouses(false);
    }
  };

  // Handle warehouse selection and proceed to dashboard
  const handleWarehouseSelection = () => {
    if (!selectedWarehouse) {
      setError("Please select a warehouse to continue.");
      return;
    }

    // Store selected warehouse in localStorage
    localStorage.setItem("selectedWarehouse", JSON.stringify(selectedWarehouse));
    
    // Close modal and navigate to admin dashboard
    setShowWarehouseModal(false);
    navigate("/admin-dashboard");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axios.post("http://localhost:8080/api/login/", {
        username,
        password,
      });

      const { role, must_change_password, id } = res.data;

      localStorage.setItem("user", JSON.stringify(res.data));
      localStorage.setItem("access", JSON.stringify(res.data.accessibilities));

      if (must_change_password) {
        navigate("/change-password", { state: { userId: id } });
      } else {
        // If admin, show warehouse selection modal
        if (role?.toLowerCase() === "admin") {
          await fetchWarehouses();
          setShowWarehouseModal(true);
        } else {
          // For non-admin users, navigate directly
          switch (role?.toLowerCase()) {
            case "cashier":
              navigate("/cashier-dashboard");
              break;
            case "manager":
              navigate("/manager-dashboard");
              break;
            default:
              navigate("/user-dashboard");
          }
        }
      }
    } catch (err) {
      if (err.response?.data?.non_field_errors) {
        setError(err.response.data.non_field_errors[0]);
      } else {
        setError("Login failed. Please check your credentials.");
      }
    }
  };

  // Close modal function
  const closeModal = () => {
    setShowWarehouseModal(false);
    setSelectedWarehouse(null);
    setError("");
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans">
      {/* Left - Welcome Panel */}
      <div className="w-1/2 bg-white relative flex items-center justify-center overflow-hidden">
        <div className="absolute right-0 top-0 h-full w-[4px] bg-gradient-to-b from-pink-500 via-red-400 to-orange-300 z-10" />
        <div className="z-20 text-center">
          <h1 className="text-5xl font-extrabold text-pink-600 mb-2 tracking-wide">WELCOME !</h1>
          <p className="text-gray-500 text-md">Log in to continue</p>
        </div>
        <div className="absolute inset-0 z-0">
          <div className="absolute top-6 left-10 w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 shadow-lg animate-float" />
          <div className="absolute top-[-50px] right-[-50px] w-64 h-64 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 shadow-lg animate-float" />
          <div className="absolute top-1/3 left-20 w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 shadow-lg animate-float" />
          <div className="absolute top-[70%] right-[15%] w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 shadow-lg animate-float" />
          <div className="absolute bottom-3 right-3 w-3 h-3 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 shadow-lg animate-float" />
          <div className="absolute bottom-[30%] left-[45%] w-4 h-4 rounded-full bg-pink-300 animate-float" />
          <div className="absolute top-[10%] right-[25%] w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 shadow-md animate-float" />
          <div className="absolute bottom-[15%] left-[15%] w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 shadow-md animate-float" />
          <div className="absolute top-[60%] left-[60%] w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 shadow-md animate-float" />
          <div className="absolute top-1/2 right-8 w-32 h-32 rounded-full border-[6px] border-transparent animate-float" style={{ borderImage: "linear-gradient(to bottom right, #ec4899, #ef4444, #f59e0b) 1" }} />
          <div className="absolute bottom-[-20px] left-[-20px] w-28 h-28 rounded-full border-[6px] border-transparent animate-float" style={{ borderImage: "linear-gradient(to bottom right, #ec4899, #ef4444, #f59e0b) 1" }} />
          <div className="absolute top-[25%] left-[75%] w-20 h-20 rounded-full border-[5px] border-transparent animate-float" style={{ borderImage: "linear-gradient(to bottom right, #ec4899, #ef4444, #f59e0b) 1" }} />
          <div className="absolute bottom-[10%] right-[35%] w-16 h-16 rounded-full border-[5px] border-transparent animate-float" style={{ borderImage: "linear-gradient(to bottom right, #ec4899, #ef4444, #f59e0b) 1" }} />
          <div className="absolute top-[40%] left-[10%] w-10 h-10 bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400 rotate-12 shadow-md animate-float" />
          <div className="absolute bottom-[20%] right-[10%] w-8 h-8 bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400 rotate-45 shadow-md animate-float" />
          <div className="absolute top-[15%] right-[40%] w-6 h-6 bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400 rotate-[30deg] shadow-md animate-float" />
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="w-1/2 bg-[#0e121e] relative flex items-center justify-center p-10 text-white overflow-hidden">
        {/* Form Card */}
        <form onSubmit={handleLogin} className="w-full max-w-sm z-10 mt-10">
          <img
            src="/static/images/Wilfie's 5.png"
            alt="Logo"
            className="w-[220px] h-[220px] object-contain mx-auto mb-6 drop-shadow"
          />
          <h2 className="text-5xl font-bold mb-8 text-white tracking-wider font-sans text-center drop-shadow-md">
            Login
          </h2>

          {error && (
            <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4 text-sm shadow">
              {error}
            </div>
          )}

          <input
            type="text"
            placeholder="Username"
            className="w-full px-4 py-3 mb-4 rounded bg-white text-black focus:outline-none shadow"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-3 mb-4 rounded bg-white text-black focus:outline-none shadow"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <p
            className="text-sm mb-4 text-right hover:underline cursor-pointer text-gray-300"
            onClick={() => navigate("/forgot-password")}
          >
            Forgot your password?
          </p>

          <button
            type="submit"
            className="w-full py-3 rounded bg-red-600 text-white font-bold hover:bg-white hover:text-red-600 border-2 border-red-600 transition-all"
          >
            Log In
          </button>
        </form>

        {/* Bubbles and Circles */}
        <div className="absolute -bottom-10 left-5 w-24 h-24 bg-red-600 rounded-full opacity-10 animate-ping" />
        <div className="absolute top-10 right-10 w-20 h-20 bg-white rounded-full opacity-5 animate-pulse" />
        <div className="absolute bottom-[25%] right-[20%] w-12 h-12 bg-red-600 rounded-full opacity-20 animate-bounce" />
      </div>

      {/* Warehouse Selection Modal */}
      {showWarehouseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white">
                Select Warehouse
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {loadingWarehouses ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-300">Loading warehouses...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Please select a warehouse to continue:
                </p>
                
                {warehouses.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No warehouses available</p>
                ) : (
                  warehouses.map((warehouse) => (
                    <div
                      key={warehouse.id}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                        selectedWarehouse?.id === warehouse.id
                          ? "border-red-600 bg-red-50 dark:bg-red-900/20"
                          : "border-gray-200 dark:border-gray-600 hover:border-red-300"
                      }`}
                      onClick={() => setSelectedWarehouse(warehouse)}
                    >
                      <h4 className="font-semibold text-gray-800 dark:text-white">
                        {warehouse.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {warehouse.street}, {warehouse.city}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {warehouse.country}
                      </p>
                    </div>
                  ))
                )}

                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-600">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWarehouseSelection}
                    disabled={!selectedWarehouse}
                    className={`px-6 py-2 rounded font-semibold transition-all ${
                      selectedWarehouse
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;