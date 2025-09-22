import React, { useState, useEffect } from "react";
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

  // Restore selected warehouse on refresh
  useEffect(() => {
    const savedWarehouse = localStorage.getItem("selectedWarehouse");
    if (savedWarehouse) {
      setSelectedWarehouse(JSON.parse(savedWarehouse));
    }
  }, []);

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

  // Handle warehouse selection
  const handleWarehouseSelection = () => {
    if (!selectedWarehouse) {
      setError("Please select a warehouse to continue.");
      return;
    }
    localStorage.setItem("selectedWarehouse", JSON.stringify(selectedWarehouse));
    setShowWarehouseModal(false);
    navigate("/dashboard"); // navigate to main dashboard
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
        if (role?.toLowerCase() === "admin") {
          await fetchWarehouses();
          setShowWarehouseModal(true);
        } else {
          // For non-admins, navigate to dashboard
          navigate("/dashboard");
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

  const closeModal = () => {
    setShowWarehouseModal(false);
    setError("");
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans">
      {/* Left panel skipped for brevity */}
      {/* Right panel - login form */}
      <div className="w-1/2 bg-[#0e121e] flex items-center justify-center p-10 text-white overflow-hidden">
        <form onSubmit={handleLogin} className="w-full max-w-sm z-10 mt-10">
          <h2 className="text-5xl font-bold mb-8 text-white text-center">Login</h2>

          {error && <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4">{error}</div>}

          <input
            type="text"
            placeholder="Username"
            className="w-full px-4 py-3 mb-4 rounded text-black"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-3 mb-4 rounded text-black"
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

        {/* Warehouse Modal */}
        {showWarehouseModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800">Select Warehouse</h3>
                <button onClick={closeModal} className="text-gray-500 text-2xl font-bold">×</button>
              </div>

              {loadingWarehouses ? (
                <div className="text-center py-8">Loading warehouses...</div>
              ) : (
                <div className="space-y-3">
                  {warehouses.map((w) => (
                    <div
                      key={w.id}
                      className={`p-4 border-2 rounded-lg cursor-pointer ${
                        selectedWarehouse?.id === w.id
                          ? "border-red-600 bg-red-50"
                          : "border-gray-200 hover:border-red-300"
                      }`}
                      onClick={() => setSelectedWarehouse(w)}
                    >
                      <h4 className="font-semibold">{w.name}</h4>
                      <p className="text-sm">{w.street}, {w.city}</p>
                    </div>
                  ))}

                  <div className="flex justify-end space-x-3 pt-6">
                    <button onClick={closeModal} className="px-4 py-2 rounded border">Cancel</button>
                    <button
                      onClick={handleWarehouseSelection}
                      disabled={!selectedWarehouse}
                      className={`px-6 py-2 rounded font-semibold ${
                        selectedWarehouse ? "bg-red-600 text-white" : "bg-gray-300 text-gray-500 cursor-not-allowed"
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
    </div>
  );
};

export default Login;