import React, { useState } from "react";
import WifiLoader from "../components/WifiLoader"; // keep your loader
import api from "../api"; // ✅ correct

const ForgotPasswordModal = ({ onClose, onOtpSent }) => {
  const [phoneNumber, setPhoneNumber] = useState(""); // Changed from email to phone_number
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePhoneNumberChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, "");
    setPhoneNumber(digitsOnly.slice(0, 11));
  };

  // Function to validate phone number (Philippine local format)
  const validatePhoneNumber = (phone) => {
    const regex = /^09[0-9]{9}$/;
    return regex.test(phone);
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setMessage("");
    setSuccess(false);
    setLoading(true);

    // Validate phone number format
    if (!validatePhoneNumber(phoneNumber)) {
      setLoading(false);
      setMessage("Invalid phone number. Use 11 digits starting with 09.");
      return;
    }

    try {
      await api.post("/forgot-password/send-otp/", { phone_number: phoneNumber });
      localStorage.setItem("resetPhoneNumber", phoneNumber);
      setSuccess(true);
      setMessage("OTP sent successfully. Please check your phone.");

      setTimeout(() => {
        setLoading(false);
        if (onOtpSent) {
          onOtpSent(); // Trigger OTP verification modal
        }
      }, 1500);
    } catch (err) {
      console.error("❌ Send OTP error:", err.response?.data || err.message);
      setLoading(false);
      setMessage("Failed to send OTP. Please check the phone number.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      {/* Modal card */}
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md p-8 border border-gray-300">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-500 hover:text-blue-500 text-2xl font-bold"
        >
          ×
        </button>

        <h2 className="text-2xl font-extrabold text-center text-gray-800 mb-3">
          Forgot Password
        </h2>
        <p className="text-center text-gray-500 text-sm mb-6">
          Enter your phone number to receive a one-time password (OTP).
        </p>

        <form onSubmit={handleSendOTP}>
          <label
            htmlFor="phone_number"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Phone Number
          </label>
          <input
            type="text"
            id="phone_number"
            name="forgot-password-phone"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="09XXXXXXXXX"
            className="w-full border border-gray-300 rounded-md px-4 py-2 mb-4 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={phoneNumber}
            onChange={handlePhoneNumberChange}
            required
            maxLength={11}
          />

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md transition duration-200 shadow-sm"
          >
            Send OTP
          </button>

          {message && (
            <p
              className={`text-sm text-center mt-4 font-medium ${message.toLowerCase().includes("failed")
                ? "text-red-600"
                : "text-green-600"
                }`}
            >
              {message}
            </p>
          )}
        </form>

        {/* Loader & Success Check */}
        {loading && (
          success ? (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-bounceCheck">
              <span className="text-green-500 text-6xl font-bold">✔</span>
            </div>
          ) : (
            <WifiLoader />
          )
        )}
      </div>

      <style>
        {`
          @keyframes bounceCheck {
            0% { transform: scale(0.3); opacity: 0; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); }
          }
          .animate-bounceCheck {
            animation: bounceCheck 0.5s ease-out;
          }
        `}
      </style>
    </div>
  );
};

export default ForgotPasswordModal;
