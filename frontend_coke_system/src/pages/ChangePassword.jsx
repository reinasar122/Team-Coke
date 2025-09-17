import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";

// Strong password check
const isStrongPassword = (password) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);

const ChangePassword = () => {
  const navigate = useNavigate();
  const { uid, token } = useParams(); // URL params from reset link

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Check if UID and token are present in the URL
  useEffect(() => {
    if (!uid || !token) navigate("/login");
  }, [uid, token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validate form input
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
      // Send request to backend to update password
      const payload = {
        uid: decodeURIComponent(uid),
        token: decodeURIComponent(token),
        new_password: newPassword,
      };

      const response = await axios.post("http://localhost:8080/api/change-password/", payload);

      // Show success message and redirect to login
      setSuccess("Password changed successfully! Redirecting...");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      console.error("Password change error:", err);
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Failed to update password. Link may be invalid or expired.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Helper to determine the color of validation messages
  const getValidationColor = (condition) =>
    condition ? "text-green-600 font-semibold" : "text-gray-500";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h3 className="text-xl font-bold mb-4 text-center">Change Password</h3>

        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        {success && <div className="text-green-600 text-sm mb-2">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block font-medium mb-1">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full p-2 border rounded"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-2 top-2 text-gray-500 text-sm"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className="block font-medium mb-1">Confirm Password</label>
            <input
              type={showPassword ? "text" : "password"}
              className="w-full p-2 border rounded"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <ul className="mb-4 text-sm">
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

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 rounded text-white ${
              loading ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"
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
