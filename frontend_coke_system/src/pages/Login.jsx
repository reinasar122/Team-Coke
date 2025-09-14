import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

// Spinner component
const Spinner = ({ size = 5 }) => (
  <svg
    className="animate-spin"
    style={{ height: `${size * 4}px`, width: `${size * 4}px` }}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.15" />
    <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const Login = () => {
  const navigate = useNavigate();

  // States
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [warehouses, setWarehouses] = useState([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);

  // Restore remembered username
  useEffect(() => {
    const saved = localStorage.getItem("remember_username");
    if (saved) setUsername(saved);
  }, []);

  // Login handler
  const handleLogin = async (e) => {
  e.preventDefault();
  setError("");
  setLoading(true);

  try {
    const res = await axios.post("http://127.0.0.1:8080/api/login/", { username, password });
    const user = res.data.user || res.data;
    const access = res.data.accessibilities || [];

    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("access", JSON.stringify(access));

    if (remember) localStorage.setItem("remember_username", username);
    else localStorage.removeItem("remember_username");

    // --- If admin, fetch warehouses separately ---
    if (user.role?.name?.toLowerCase() === "admin") {
      setLoadingWarehouses(true);
      try {
        const warehouseRes = await axios.get("http://127.0.0.1:8080/api/warehouses/");
        setWarehouses(warehouseRes.data);
        if (warehouseRes.data.length > 0) setSelectedWarehouse(warehouseRes.data[0]);
        setShowWarehouseModal(true); // Show modal
      } catch (err) {
        setError("Failed to fetch warehouses.");
        console.error(err);
      } finally {
        setLoadingWarehouses(false);
      }
      return; // stop here for admin
    }

    // Non-admin logic
    navigate("/dashboard");

  } catch (err) {
    setError(err?.response?.data?.non_field_errors?.[0] || "Invalid username or password.");
  } finally {
    setLoading(false);
  }
};



  const handleWarehouseSelection = () => {
    if (!selectedWarehouse) {
      setError("Please select a warehouse to continue.");
      return;
    }
    localStorage.setItem("selectedWarehouse", JSON.stringify(selectedWarehouse));
    setShowWarehouseModal(false);
    navigate("/dashboard");
  };

  const closeModal = () => setShowWarehouseModal(false);
  const logoSrc = encodeURI("/static/images/Wilfie’s 5.png");

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black">
      {/* Background glow circles */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-700 rounded-full blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute -bottom-32 -right-24 w-80 h-80 bg-red-800 rounded-full blur-3xl opacity-25 animate-pulse"></div>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="rounded-3xl bg-white/10 backdrop-blur-md shadow-2xl p-10 border border-white/20">
          <div className="flex flex-col items-center mb-6">
            <div className="w-52 h-52 rounded-full bg-white flex items-center justify-center mb-4">
              <img src={logoSrc} alt="Wilfie's Logo" className="w-80 h-80 rounded-full object-cover mb-1" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-1">Welcome back</h1>
            <p className="text-sm text-gray-200 text-center">Sign in to Continue</p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/20 border border-red-700 text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username or email"
                required
                autoComplete="username"
                className="w-full rounded-xl border border-gray-400/50 px-4 py-3 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 bg-white/10"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-gray-400/50 px-4 py-3 pr-28 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 bg-white/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-red-400 hover:text-red-600"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-gray-200 select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-400"
                />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="text-sm text-red-400 font-semibold hover:text-red-600 hover:underline"
              >
                Forgot?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-semibold transition-all ${
                loading ? "bg-red-700/80 text-white cursor-wait" : "bg-red-600 text-white hover:bg-red-700"
              }`}
            >
              {loading && <Spinner size={4} />}
              <span>{loading ? "Signing in..." : "Sign in"}</span>
            </button>
          </form>

          <div className="mt-8 border-t border-white/20 pt-5 text-center">
            <p className="text-sm text-gray-200">
              Don’t have an account?{" "}
              <button
                onClick={() => navigate("/register")}
                className="text-red-400 font-semibold hover:text-red-600 hover:underline"
              >
                Contact the Admin
              </button>
            </p>
          </div>
        </div>
      </div>

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
                    <p className="text-sm text-gray-600">{w.street}, {w.city}</p>
                  </div>
                ))}

                <div className="flex justify-end space-x-3 pt-6">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 rounded border text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWarehouseSelection}
                    disabled={!selectedWarehouse}
                    className={`px-6 py-2 rounded font-semibold transition-colors ${
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
