import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api"; // ✅ correct
import { FaEye, FaEyeSlash } from "react-icons/fa";

const isStrongPassword = (password) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);

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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background Design */}
      <div className="absolute inset-0 bg-black">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-neutral-900 to-red-900 opacity-90"></div>
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-red-600 rounded-full blur-[150px] opacity-30 animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-white rounded-full blur-[200px] opacity-10"></div>
      </div>

      {/* Card */}
      <div className="relative bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white-600">
        <h3 className="text-2xl font-bold mb-6 text-center text-white uppercase tracking-wide">
          {isMandatoryChange ? "Set New Password" : "Change Password"}
        </h3>
       
        {isMandatoryChange && (
          <p className="text-center text-gray-300 text-sm mb-4">
            Please set a new password to continue using your account.
          </p>
        )}

        {error && (
          <div className="bg-red-600 text-white text-sm p-2 rounded mb-3">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-600 text-white text-sm p-2 rounded mb-3">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* New Password */}
          <div>
            <label className="block text-sm font-medium mb-1 text-white">
              New Password
              </label>
             
              <div className="relative">
                <input
                type={showPassword ? "text" : "password"}
                className="w-full p-3 pr-10 bg-black/70 text-white border border-gray-600 rounded focus:outline-none focus:border-red-500"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                />
               
                <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-500"
                aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {!showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                  </button>
                  </div>

                  </div>
                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-white">
                      Confirm Password
                      </label>
                      <div className="relative">
                        <input
                        type={showConfirmPassword ? "text" : "password"}
                        className="w-full p-3 pr-10 bg-black/70 text-white border border-gray-600 rounded focus:outline-none focus:border-red-500"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-500"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {!showConfirmPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                          </button>
                          </div>
                          </div>
                         
          {/* Password requirements */}
          <ul className="space-y-1 text-xs">
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

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded text-white font-bold uppercase tracking-wide ${
              loading
                ? "bg-red-400 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700 transition"
            }`}
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
