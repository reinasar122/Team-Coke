import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import ForgotPasswordModal from "./ForgotPassword";
import VerifyOTPModal from "./VerifyOTP";
import { routeMap, routeOrder } from "../utils/routeMap";
import api from "../api"; // ✅ correct

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
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showVerifyOTPModal, setShowVerifyOTPModal] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  // ✅ Find the first accessible route based on user permissions
  const getFirstAccessibleRoute = () => {
    const accessList = JSON.parse(localStorage.getItem("access") || "[]");

    // Build a quick lookup for allowed submenus
    const allowed = new Set(
        accessList.filter(acc => acc.full || acc.view).map(acc => acc.submenu)
      );

      // Go through sidebar order and find the first allowed route
      for (const submenu of routeOrder) {
        if (allowed.has(submenu) && routeMap[submenu]) {
          return routeMap[submenu];
        }
      }

      return "/no-access"; // fallback if no permissions
    };

  // ✅ Handle success after OTP verification
  const handleOtpVerified = (encodedUid, token) => {
    setShowVerifyOTPModal(false); // close modal
    navigate(`/change-password/${encodedUid}/${token}`); // go to Change Password
  };

  const fetchWarehouses = async () => {
    setLoadingWarehouses(true);
    try {
      const res = await api.get("/warehouses/");
      setWarehouses(res.data);
      if (res.data.length > 0) setSelectedWarehouse(res.data[0]);
    } catch (err) {
      setError("Failed to load warehouses. Please try again.");
    } finally {
      setLoadingWarehouses(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/login/", { username, password });

      // Log the response data to check if it's structured as expected
      console.log("Login successful, response:", res.data);

      const { role, must_change_password, id } = res.data;

      // Store user data and access permissions in localStorage
      localStorage.setItem("user", JSON.stringify(res.data)); // Store user info
      localStorage.setItem("access", JSON.stringify(res.data.accessibilities)); // Store accessibilities
      
      // ✅ IMPORTANT: Store login timestamp for notification system
      localStorage.setItem("loginTime", Date.now().toString());

      // ✅ IMPORTANT: Dispatch login event to trigger notifications
      console.log("🔐 Dispatching userLoggedIn event...");
      window.dispatchEvent(new CustomEvent('userLoggedIn'));

      // Log role and must_change_password values for debugging
      console.log("Role:", role);
      console.log("Must change password:", must_change_password);

      if (must_change_password) {
        // Redirect to change password page
        navigate("/change-password", { state: { userId: id } });
      } else if (role?.toLowerCase() === "admin") {
        // Admin logic: fetch warehouses and show modal
        await fetchWarehouses();
        setShowWarehouseModal(true);
      } else {
        // ✅ IMPORTANT: For non-admin users, dispatch warehouse-related events to trigger notifications
        setTimeout(() => {
          console.log("🔐 Non-admin user login - triggering notification events...");
          
          // Dispatch warehouse change event for non-admin users
          const warehouseInfo = {
            id: res.data.warehouse_id,
            name: res.data.warehouse || 'User Warehouse'
          };
          
          if (res.data.warehouse_id) {
            window.dispatchEvent(
              new CustomEvent("warehouseChanged", {
                detail: { warehouse: warehouseInfo, action: "login", source: "non-admin-login" },
              })
            );
          }
          
          // Dispatch session restore event to trigger notification check
          window.dispatchEvent(new CustomEvent('userSessionRestored'));
        }, 1000);
        
        // ✅ Use routeMap to find the first accessible route for non-admin users
        const firstRoute = getFirstAccessibleRoute();
        console.log("➡️ Redirecting to:", firstRoute);
        navigate(firstRoute);
      }
    } catch (err) {
      // Log the error for debugging
      console.error("Login error:", err);
      setError(
        err.response?.data?.non_field_errors?.[0] || "Login failed. Please check your credentials."
      );
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
    
    // ✅ IMPORTANT: Dispatch warehouse change event
    window.dispatchEvent(
      new CustomEvent("warehouseChanged", {
        detail: { warehouse: selectedWarehouse, action: "select", source: "login" },
      })
    );
    
    // ✅ IMPORTANT: Trigger notification check after warehouse selection
    setTimeout(() => {
      console.log("🔐 Admin warehouse selected - triggering notification check...");
      window.dispatchEvent(new CustomEvent('userSessionRestored'));
    }, 1000);
    
    // ✅ Use routeMap to find the first accessible route for admin after warehouse selection
    const firstRoute = getFirstAccessibleRoute();
    console.log("➡️ Admin redirecting to:", firstRoute);
    navigate(firstRoute);
  };

  const closeModal = () => {
    setShowWarehouseModal(false);
    setSelectedWarehouse(null);
    setError("");
  };

  const logoSrc = process.env.PUBLIC_URL + "/static/images/Wilfie’s 5.png";

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black">
      {/* Background glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-700 rounded-full blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute -bottom-32 -right-24 w-80 h-80 bg-red-800 rounded-full blur-3xl opacity-25 animate-pulse"></div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="rounded-3xl bg-white/10 backdrop-blur-md shadow-2xl p-10 border border-white/20">
          <div className="flex flex-col items-center mb-6">
            <div className="w-52 h-52 rounded-full bg-white flex items-center justify-center mb-4">
              <img src={logoSrc} alt="Logo" className="w-80 h-80 rounded-full object-cover mb-1" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-1">Welcome</h1>
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
                  className="w-full rounded-xl border border-gray-400/50 px-4 py-3 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 bg-white/10"
                  style={showPassword ? { WebkitTextSecurity: "none" } : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-red-500"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember Me + Forgot Password */}
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

              <p
                className="text-sm text-red-400 hover:underline cursor-pointer"
                onClick={() => setShowForgotModal(true)}
              >
                Forgot password?
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-semibold transition-all ${
                loading
                  ? "bg-red-700/80 text-white cursor-wait"
                  : "bg-red-600 text-white hover:bg-red-700"
              }`}
            >
              {loading && <Spinner size={4} />}
              <span>{loading ? "Signing in..." : "Sign in"}</span>
            </button>

            <div className="mt-8 border-t border-white/20 pt-5 text-center">
              <p className="text-sm text-gray-200">
                Don't have an account?{" "}
                <button
                  onClick={() => navigate("/register")}
                  className="text-red-400 font-semibold hover:text-red-600 hover:underline"
                >
                  Contact the Admin
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Warehouse Modal */}
      {showWarehouseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
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

      {/* Forgot Password Modal Overlay */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <ForgotPasswordModal
            onClose={() => setShowForgotModal(false)}
            onOtpSent={() => {
              setShowForgotModal(false);
              setShowVerifyOTPModal(true);
            }}
          />
        </div>
      )}

      {/* Verify OTP Modal Overlay */}
      {showVerifyOTPModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <VerifyOTPModal
            onClose={() => setShowVerifyOTPModal(false)}
            onVerified={handleOtpVerified} // ✅ function is now defined
          />
        </div>
      )}
    </div>
  );
};

export default Login;