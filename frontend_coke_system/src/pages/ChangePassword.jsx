import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";  
import api from "../api"; // ✅ correct

const isStrongPassword = (password) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);

const ChangePassword = () => {
  const navigate = useNavigate();
  const { uid, token } = useParams();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!uid || !token) navigate("/login");
  }, [uid, token, navigate]);

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
      const payload = {
        uid: decodeURIComponent(uid),
        token: decodeURIComponent(token),
        new_password: newPassword,
      };
      await api.post("/change-password/", payload);

      setSuccess("✅ Password changed successfully! Redirecting...");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Failed to update password. Link may be invalid or expired.";
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
          Change Password
        </h3>

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
                className="w-full p-3 bg-black/70 text-white border border-gray-600 rounded focus:outline-none focus:border-red-500"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-3 text-xs text-red-400 hover:text-red-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium mb-1 text-white">
              Confirm Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              className="w-full p-3 bg-black/70 text-white border border-gray-600 rounded focus:outline-none focus:border-red-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
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