import { useState, useRef, useEffect } from "react";
import api from "../api";

const VerifyOTPModal = ({ onClose, onVerified, phone = null, mode = "signup" }) => {
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [timer, setTimer] = useState(120);
  const [canResend, setCanResend] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputsRef = useRef([]);
  const submittedOtpRef = useRef("");

  useEffect(() => {
    let countdownInterval;
    if (timer > 0 && !canResend) {
      countdownInterval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setCanResend(true);
      clearInterval(countdownInterval);
    }
    return () => clearInterval(countdownInterval);
  }, [timer, canResend]);

  const handleChange = (index, value) => {
    if (!/^[0-9]?$/.test(value)) return;

    const newOtp = [...otpDigits];
    newOtp[index] = value;
    setOtpDigits(newOtp);

    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pastedOtp = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pastedOtp) return;

    e.preventDefault();
    const newOtp = Array.from({ length: 6 }, (_, index) => pastedOtp[index] || "");
    setOtpDigits(newOtp);
    inputsRef.current[Math.min(pastedOtp.length, 6) - 1]?.focus();
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

  const verifyOtp = async (otp) => {
    if (isVerifying) return;
    setError("");
    if (otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP.");
      return;
    }

    setIsVerifying(true);

    try {
      if (!phone) {
        setError("Phone number not found. Please restart the process.");
        return;
      }

      let response;
      
      if (mode === "signup") {
        response = await api.post("/verify-phone-otp/", {
          phone_number: phone,
          otp,
          mode: "signup"
        });

        console.log("VERIFY PHONE OTP RESPONSE:", response.data);

        if (typeof onVerified === "function") {
          onVerified();
        }
      } else if (mode === "forgot") {
        try {
          response = await api.post("/forgot-password/verify-phone-otp/", {
            phone_number: phone,
            otp,
            mode: "forgot"
          });
        } catch (forgotError) {
          console.warn("Forgot password endpoint failed, trying general verify endpoint");
          response = await api.post("/verify-phone-otp/", {
            phone_number: phone,
            otp,
            mode: "forgot"
          });
        }

        console.log("VERIFY PHONE OTP FORGOT PASSWORD RESPONSE:", response.data);

        if (response.status === 200 || response.status === 201) {
          if (typeof onVerified === "function") {
            const encodedUid = response.data?.encoded_uid;
            const token = response.data?.token;
            
            // If backend doesn't provide tokens, handle differently
            if (!encodedUid || !token) {
              localStorage.setItem("verifiedResetPhone", phone);
              onVerified("verified", "phone");
            } else {
              onVerified(encodedUid, token);
            }
          }
        } else {
          setError("Invalid OTP. Please try again.");
        }
      }
    } catch (err) {
      console.error("OTP Verify Error:", err);
      
      let errorMessage = "An unexpected error occurred. Please try again.";
      
      if (err.response?.data) {
        const errorData = err.response.data;
        if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.non_field_errors && errorData.non_field_errors[0]) {
          errorMessage = errorData.non_field_errors[0];
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
      } else if (err.request) {
        errorMessage = "Unable to connect to server. Please check your internet connection.";
      }
      
      setError(errorMessage);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerify = (e) => {
    e.preventDefault();
    void verifyOtp(otpDigits.join(""));
  };

  useEffect(() => {
    const otp = otpDigits.join("");
    if (otp.length < 6) {
      submittedOtpRef.current = "";
      return;
    }

    if (submittedOtpRef.current === otp || isVerifying) return;
    submittedOtpRef.current = otp;
    void verifyOtp(otp);
  }, [otpDigits, isVerifying]);

  const handleResendOTP = async () => {
    if (!canResend) return;

    setCanResend(false);
    setTimer(120);

    try {
      let endpoint = "/send-phone-otp/";
      if (mode === "forgot") {
        endpoint = "/forgot-password/send-otp/";
      }
      
      const response = await api.post(endpoint, { phone_number: phone });
      console.log("Resend OTP response:", response.data);
      setError("");
      
      setError("OTP sent successfully!");
      setTimeout(() => setError(""), 3000);
    } catch (err) {
      console.error("Resend OTP Error:", err);
      setError("Failed to resend OTP. Please try again.");
      setCanResend(true);
    }
  };

  const targetText = mode === "signup" ? `the number ${phone || ""}` : "your phone number";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md p-8 border border-gray-300">
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
          Enter the 6-digit code sent to {targetText}
        </p>

        {error && (
          <p className={`text-center mb-4 text-sm font-medium ${
            error.includes("sent successfully") ? "text-green-600" : "text-red-600"
          }`}>
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
                onPaste={handlePaste}
                className="w-12 h-12 text-center text-xl rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-md transition duration-200 shadow-sm"
          >
            {isVerifying ? "Verifying..." : "Verify"}
          </button>
        </form>

        <div className="flex justify-center mt-4">
          <button
            onClick={handleResendOTP}
            className="text-sm text-red-600 hover:text-red-700"
            disabled={!canResend}
          >
            {canResend ? "Resend OTP" : `Resend OTP in ${timer}s`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyOTPModal;
