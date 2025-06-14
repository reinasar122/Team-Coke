import { useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const VerifyOTP = () => {
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const email = localStorage.getItem("resetEmail");
  const navigate = useNavigate();
  const inputsRef = useRef([]);

  const handleChange = (index, value) => {
    if (!/^[0-9]?$/.test(value)) return; // Only allow digit or empty

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
        const response = await axios.post("http://localhost:8080/api/forgot-password/verify-otp/", {
          email,
          otp,
        });

        const user = response.data?.user;
        if (!user || !user.id) {
          setError("User data missing. Please restart.");
          return;
        }

        // ✅ Save user object for ChangePassword.jsx
        localStorage.setItem("user", JSON.stringify(user));

        navigate("/change-password");
      } catch (err) {
        setError(err.response?.data?.error || "Invalid OTP. Try again.");
      }
    };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 font-sans px-4">
      <form
        onSubmit={handleVerify}
        className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md border border-gray-200"
      >
        <h2 className="text-2xl font-extrabold text-center text-gray-700 mb-2">Verify OTP</h2>
        <p className="text-center text-gray-500 text-sm mb-6">
          Enter the 6-digit code sent to your email
        </p>

        {error && (
          <p className="text-red-600 text-center mb-4 text-sm font-medium">{error}</p>
        )}

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
              className="w-14 h-14 text-center text-2xl rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ))}
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md transition duration-200 shadow-sm"
        >
          Verify
        </button>
      </form>
    </div>
  );
};

export default VerifyOTP;
