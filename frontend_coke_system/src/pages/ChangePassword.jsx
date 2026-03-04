import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api"; // ✅ correct
import { FaEye, FaEyeSlash } from "react-icons/fa";

const isStrongPassword = (password) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);

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

const ChangePassword = () => {
  const navigate = useNavigate();
  const { id, uid, token } = useParams(); // ✅ Added id param

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ✅ Updated logic to properly detect scenarios
  const isMandatoryChange = id && !uid && !token; // Has id but no uid/token = mandatory change
  const isForgotPassword = uid && token && !id;   // Has uid/token but no id = forgot password
  const userFromStorage = isMandatoryChange ? JSON.parse(localStorage.getItem("user") || "{}") : null;

  useEffect(() => {
    console.log("🔍 ChangePassword component loaded with params:", { id, uid, token });
    console.log("📋 Detected scenario:", { isMandatoryChange, isForgotPassword });

    // ✅ Better validation for different scenarios
    if (isForgotPassword && (!uid || !token)) {
      console.log("❌ Missing uid/token for password reset, redirecting to login");
      navigate("/login");
      return;
    }
   
    if (isMandatoryChange && (!id || !userFromStorage?.id)) {
      console.log("❌ Missing user data for mandatory change, redirecting to login");
      navigate("/login");
      return;
    }

    // ✅ If neither scenario matches, it's an invalid route
    if (!isMandatoryChange && !isForgotPassword) {
      console.log("❌ Invalid change password route, redirecting to login");
      navigate("/login");
      return;
    }
  }, [id, uid, token, navigate, isMandatoryChange, isForgotPassword, userFromStorage]);

  const getAccessibleRoutes = () => {
    const accessList = JSON.parse(localStorage.getItem("access") || "[]");
    const routeMap = {
      // Add your route mapping here based on your routeMap from Login component
      "dashboard": "/dashboard",
      "users": "/users",
      "products": "/products",
      // ... add other routes
    };
    const routeOrder = ["dashboard", "users", "products"]; // Replace with your actual route order
   
    const allowed = new Set(
      accessList.filter((acc) => acc.full || acc.view).map((acc) => acc.submenu)
    );

    return routeOrder.filter(submenu => allowed.has(submenu) && routeMap[submenu]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!isStrongPassword(newPassword)) {
      setError(
        "Password must be at least 8 characters, with uppercase, lowercase, number, and special character."
      );
      return;
    }

    setLoading(true);
    try {
      let payload;
      let endpoint;

      if (isMandatoryChange) {
        // ✅ Mandatory password change after first login
        console.log("🔄 Processing mandatory password change for user:", id);
        payload = {
          user_id: id, // ✅ Use id from URL params
          new_password: newPassword,
        };
        endpoint = "/mandatory-change-password/";
      } else if (isForgotPassword) {
        // ✅ Password reset via email/SMS
        console.log("🔄 Processing forgot password reset");
        payload = {
          uid: decodeURIComponent(uid),
          token: decodeURIComponent(token),
          new_password: newPassword,
        };
        endpoint = "/change-password/";
      }

      console.log("📡 Making API request to:", endpoint);
      await api.post(endpoint, payload);

      if (isMandatoryChange) {
        setSuccess("✅ Password changed successfully! Redirecting to dashboard...");
       
        // ✅ Update user data to reflect password was changed
        const updatedUser = { ...userFromStorage, must_change_password: false };
        localStorage.setItem("user", JSON.stringify(updatedUser));
       
        // ✅ Redirect to dashboard
        setTimeout(() => {
          const accessibleRoutes = getAccessibleRoutes();
          if (accessibleRoutes.length > 0) {
            console.log("🏠 Redirecting to:", accessibleRoutes[0]);
            navigate(accessibleRoutes[0]);
          } else {
            navigate("/no-access");
          }
        }, 2000);
      } else {
        setSuccess("✅ Password changed successfully! Redirecting to login...");
        setTimeout(() => navigate("/login"), 2000);
      }
    } catch (err) {
      console.error("❌ Password change error:", err);
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Failed to update password. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Change: use green when satisfied, gray when not
  const getValidationColor = (condition) =>
    condition ? "text-green-500 font-semibold" : "text-gray-400";

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black">
      {/* Background decorative elements */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-700 rounded-full blur-3xl opacity-15 animate-pulse" />
      <div className="absolute -bottom-32 -right-24 w-80 h-80 bg-red-800 rounded-full blur-3xl opacity-10 animate-pulse" />

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* ✅ Entrance animation + error shake */}
        <div
          className={`relative rounded-3xl bg-white/10 backdrop-blur-md shadow-2xl border border-white/20
          animate-[fadeInUp_.55s_ease-out] ${error ? "animate-[shake_.35s_ease-in-out]" : ""} p-10`}
        >
          {/* ✅ Loading overlay */}
          {loading && (
            <div className="absolute inset-0 rounded-3xl bg-black/30 backdrop-blur-sm flex items-center justify-center z-20">
              <div className="flex items-center gap-3 text-white">
                <Spinner size={5} />
                <span className="text-sm">Please wait...</span>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col items-center mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">
              {isMandatoryChange ? "Set New Password" : "Change Password"}
            </h1>
            <p className="text-sm text-gray-200 text-center">
              {isMandatoryChange
                ? "Please set a new password to continue using your account."
                : "Enter your new password below."}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/20 border border-red-700 text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-green-500/20 border border-green-700 text-green-200 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-xl border border-gray-400/50 px-4 py-3 pr-12 text-base text-white placeholder-gray-300 bg-white/10
                  focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400
                  focus:shadow-[0_0_0_4px_rgba(59,130,246,0.15)] transition"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-gray-200 hover:text-blue-400 transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {!showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="w-full rounded-xl border border-gray-400/50 px-4 py-3 pr-12 text-base text-white placeholder-gray-300 bg-white/10
                  focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400
                  focus:shadow-[0_0_0_4px_rgba(59,130,246,0.15)] transition"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-gray-200 hover:text-blue-400 transition"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {!showConfirmPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                </button>
              </div>
            </div>
                         
            {/* Password requirements */}
            <ul className="space-y-1 text-xs text-gray-300 mt-4">
              <li className={getValidationColor(newPassword.length >= 8)}>
                • Minimum 8 characters
              </li>
              <li className={getValidationColor(/[A-Z]/.test(newPassword))}>
                • At least one uppercase letter
              </li>
              <li className={getValidationColor(/[a-z]/.test(newPassword))}>
                • At least one lowercase letter
              </li>
              <li className={getValidationColor(/\d/.test(newPassword))}>
                • At least one number
              </li>
              <li className={getValidationColor(/[^A-Za-z0-9]/.test(newPassword))}>
                • At least one special character
              </li>
            </ul>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-semibold transition-all mt-6
              ${loading ? "bg-blue-600/80 text-white cursor-wait" : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg"}`}
            >
              {loading ? (
                <>
                  <Spinner size={4} />
                  <span>Updating...</span>
                </>
              ) : (
                "Update Password"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;

