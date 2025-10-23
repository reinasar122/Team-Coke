import { useState, useRef } from "react";
import axios from "axios";
import api from "../api";


const VerifyOTPModal = ({ onClose, onVerified }) => {
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const email = localStorage.getItem("resetEmail");
  const inputsRef = useRef([]);

  const handleChange = (index, value) => {
    if (!/^[0-9]?$/.test(value)) return;

    const newOtp = [...otpDigits];
    newOtp[index] = value;
    setOtpDigits(newOtp);

    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (otpDigits[index] === "") {
        if (index > 0) {
          inputsRef.current[index - 1]?.focus();
          const newOtp = [...otpDigits];
          newOtp[index - 1] = "";
          setOtpDigits(newOtp);
        }
      } else {
        const newOtp = [...otpDigits];
        newOtp[index] = "";
        setOtpDigits(newOtp);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Email not found. Please restart the process.");
      return;
    }

    const otp = otpDigits.join("");
    if (otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP.");
      return;
    }

    try {
      const response = await api.post(
        "/forgot-password/verify-otp/",
        { email, otp }
      );

      console.log("📨 VERIFY OTP FULL RESPONSE:", response.data);

      // ✅ Support both formats: {user: {...}} OR flat {...}
      const data = response.data;
      const user = data.user || data;

      if (!user.id || !user.token) {
        setError("User data missing. Please restart.");
        return;
      }

      // Base64 encode the user ID safely
      const encodedUid = btoa(String(user.id));

      // Save user data
      localStorage.setItem("user", JSON.stringify(user));

      // ✅ pass back encodedUid and token to parent (Login)
      if (typeof onVerified === "function") {
        onVerified(encodedUid, user.token);
      } else {
        console.warn("⚠️ onVerified prop was not passed!");
      }
    } catch (err) {
      console.error("❌ OTP Verify Error:", err);
      setError(err.response?.data?.error || "Invalid OTP. Try again.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md p-8 border border-gray-300">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-500 hover:text-red-500 text-2xl font-bold"
        >
          ×
        </button>

        <h2 className="text-2xl font-extrabold text-center text-gray-800 mb-2">
          Verify OTP
        </h2>
        <p className="text-center text-gray-500 text-sm mb-6">
          Enter the 6-digit code sent to your email
        </p>

        {error && (
          <p className="text-red-600 text-center mb-4 text-sm font-medium">
            {error}
          </p>
        )}

        <form onSubmit={handleVerify}>
          <div className="flex justify-center gap-3 mb-6">
            {otpDigits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputsRef.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-12 text-center text-xl rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            ))}
          </div>

          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-md transition duration-200 shadow-sm"
          >
            Verify
          </button>
        </form>
      </div>
    </div>
  );
};

export default VerifyOTPModal;
