import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const isStrongPassword = (password) => {
  const regex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?#&])[A-Za-z\d@$!%*?#&]{8,}$/;
  return regex.test(password);
};

const ChangePassword = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!user || !user.id) {
      setError("User session expired. Please restart the reset process.");
      return;
    }

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
        "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character."
      );
      return;
    }

    try {
      console.log("Sending to backend:", {
        user_id: user.id,
        new_password: newPassword,
      });

      await axios.post("http://localhost:8080/api/change-password/", {
        user_id: user.id,
        new_password: newPassword,
      });

      setSuccess("Password changed successfully!");
      setTimeout(() => {
        localStorage.removeItem("resetEmail");
        localStorage.removeItem("user");
        localStorage.removeItem("access");
        navigate("/login");
      }, 1500);
    } catch (err) {
      console.error("Password change error:", err.response?.data || err.message);
      setError("Failed to update password.");
    }
  };

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
            <input
              type="password"
              className="w-full p-2 border rounded"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="mb-4">
            <label className="block font-medium mb-1">Confirm Password</label>
            <input
              type="password"
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
            <li className={getValidationColor(/[@$!%*?#&]/.test(newPassword))}>
              • At least one special character
            </li>
          </ul>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
