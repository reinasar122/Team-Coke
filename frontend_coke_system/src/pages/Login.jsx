import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import ForgotPasswordModal from "./ForgotPassword";
import VerifyOTPModal from "./VerifyOTP";
import { routeMap, routeOrder } from "../utils/routeMap";
import api from "../api";

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

  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [email, setEmail] = useState("");

  const [error, setError] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loginSuccessful, setLoginSuccessful] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const navigate = useNavigate();

  // OTP mode + phone for signup verification
  const [otpMode, setOtpMode] = useState("forgot");
  const [signupPhone, setSignupPhone] = useState("");

  // Function to fetch the accessible routes based on user's access
  const getAccessibleRoutes = () => {
    const accessList = JSON.parse(localStorage.getItem("access") || "[]");
    const allowed = new Set(
      accessList.filter((acc) => acc.full || acc.view).map((acc) => acc.submenu)
    );

    return routeOrder.filter(submenu => allowed.has(submenu) && routeMap[submenu]);
  };

  // ✅ Function to check if user is default admin
  const isDefaultAdmin = (user) => {
    // Check if this is the default admin by username and phone number
    if (user.username === "admin" && user.phone_number === "09179902969") {
      return true;
    }
    
    // Option 2: By ID (if default admin always has ID 1)
    if (user.id === 1) return true;
    
    return false;
  };

  // ✅ Function to check if default admin has changed password from initial "admin123"
  const checkIfDefaultAdminChangedPassword = async () => {
    try {
      // Make API call to check if default admin still has default password
      const response = await api.post("/check-default-admin-password/");
      return response.data.password_changed || false;
    } catch (error) {
      console.error("Error checking default admin password status:", error);
      // Default to true (assume password was changed) if we can't check
      return true;
    }
  };

  const handleOtpVerified = (encodedUid, token) => {
    setShowVerifyOTPModal(false);
    if (otpMode === "forgot" && encodedUid && token) {
      navigate(`/change-password/${encodedUid}/${token}`);
    } else if (otpMode === "signup") {
      // Create custom modal instead of alert
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">✅ Success!</h3>
          <p class="text-gray-700 dark:text-gray-300 mb-4">Phone number verified.<br><br>Your account is now pending approval.</p>
          <div class="flex justify-end">
            <button class="px-4 py-2 bg-green-500 text-white hover:bg-green-600 rounded" onclick="this.closest('.fixed').remove()">OK</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      setIsSignUp(false);
      setPhoneNumber("");
      setPassword("");
      setConfirmPassword("");
      setFirstName("");
      setLastName("");
      setGender("");
      setEmail("");
    }
  };

  // Password Complexity Validation
  const passwordComplexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[@$!%*?&])([A-Za-z\d@$!%*?&]{8,})$/;
  const [passwordError, setPasswordError] = useState("");
  const [passwordValid, setPasswordValid] = useState(false);

  const checkPasswordValidity = (password) => {
    if (!password) {
      setPasswordValid(false);
      setPasswordError("");
      return;
    }

    if (!passwordComplexityRegex.test(password)) {
      setPasswordValid(false);
      setPasswordError("Password must contain at least one uppercase letter, one lowercase letter, one special character, and be at least 8 characters long.");
    } else {
      setPasswordValid(true);
      setPasswordError("");
    }
  };

  const handlePasswordChange = (e) => {
    const passwordValue = e.target.value;
    setPassword(passwordValue);
    checkPasswordValidity(passwordValue);
  };

  // ✅ Email validation function
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setSubmitted(true);

    // ✅ Enhanced validation for signup
    if (isSignUp) {
      // Check required fields
      if (!firstName.trim() || !lastName.trim() || !gender || !phoneNumber.trim() || !password || !confirmPassword) {
        setError("Please fill out all the required fields.");
        setLoading(false);
        return;
      }

      // Validate email format if provided
      if (email.trim() && !isValidEmail(email.trim())) {
        setError("Please enter a valid email address.");
        setLoading(false);
        return;
      }

      // Check if passwords match
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }

      // Check password complexity
      if (!passwordValid) {
        setError("Please fix the password requirements.");
        setLoading(false);
        return;
      }

      // Validate phone number length (adjust as needed)
      if (phoneNumber.length < 10) {
        setError("Please enter a valid phone number.");
        setLoading(false);
        return;
      }
    }

    // ✅ Build form data with proper email handling
    const formData = isSignUp
      ? {
          phone_number: phoneNumber.trim(),
          password,
          confirm_password: confirmPassword,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          gender,
          // ✅ Handle email field properly - send empty string if no email provided
          email: email.trim() || "",
        }
      : { 
          phone_number: phoneNumber.trim(), 
          password 
        };

    // Debug logs
    console.log("🚀 Submitting form...");
    console.log("📱 Phone Number:", phoneNumber);
    console.log("🔒 Password:", password ? "***PROVIDED***" : "***NOT PROVIDED***");
    console.log("📊 Form Data:", formData);
    console.log("🌐 API Endpoint:", isSignUp ? "/register/" : "/login/");

    try {
      console.log("📡 Making API request...");
      const res = await api.post(isSignUp ? "/register/" : "/login/", formData);
      console.log("✅ API Response Success:", res.data);

      if (isSignUp) {
        // ✅ Registration successful, now send OTP
        try {
          const otpRes = await api.post("/send-phone-otp/", { phone_number: phoneNumber.trim() });

          if (otpRes.status === 200) {
            setSignupPhone(phoneNumber);
            localStorage.setItem("signupPhone", phoneNumber);
            setOtpMode("signup");
            setShowVerifyOTPModal(true);
            setLoading(false);
          }
        } catch (otpErr) {
          console.error("❌ OTP Error:", otpErr);
          setError(otpErr.response?.data?.error || "Failed to send OTP. Please try again.");
          setLoading(false);
          return;
        }
        return;
      }

      // ✅ Login successful - Enhanced password change logic
      const { role, must_change_password, id, warehouse_id, warehouse, accessibilities } = res.data;
      console.log("🎉 Login successful! User data:", {
        id,
        role,
        warehouse,
        must_change_password,
        accessibilities: accessibilities?.length || 0
      });

      localStorage.setItem("user", JSON.stringify(res.data));
      localStorage.setItem("access", JSON.stringify(accessibilities));
      localStorage.setItem("loginTime", Date.now().toString());

      window.dispatchEvent(new CustomEvent("userLoggedIn"));

      // ✅ Enhanced logic for password change requirement
      const userIsDefaultAdmin = isDefaultAdmin(res.data);
      console.log("👤 Is default admin?", userIsDefaultAdmin);
      
      if (must_change_password) {
        if (userIsDefaultAdmin) {
          // Default admin must always change password if must_change_password is true
          console.log("🔄 Redirecting default admin to change password...");
          navigate(`/change-password/${id}`, { state: { userId: id } });
        } else {
          // For regular admins, check if default admin has changed their password
          console.log("🔍 Checking if default admin has changed password...");
          try {
            const defaultAdminPasswordChanged = await checkIfDefaultAdminChangedPassword();
            
            if (defaultAdminPasswordChanged) {
              // Default admin has changed password, so regular admin doesn't need to change
              console.log("✅ Default admin has changed password. Regular admin can proceed without password change.");
              const accessibleRoutes = getAccessibleRoutes();
              if (accessibleRoutes.length > 0) {
                navigate(accessibleRoutes[0]);
              } else {
                navigate("/no-access");
              }
              setLoginSuccessful(true);
            } else {
              // Default admin still has default password, so regular admin must change password
              console.log("⚠️ Default admin still has default password. Regular admin must change password.");
              navigate(`/change-password/${id}`, { state: { userId: id } });
            }
          } catch (error) {
            console.error("❌ Error checking default admin password status:", error);
            // Default to allowing login without password change if check fails
            console.log("⚠️ Could not verify default admin password status. Allowing login without password change.");
            const accessibleRoutes = getAccessibleRoutes();
            if (accessibleRoutes.length > 0) {
              navigate(accessibleRoutes[0]);
            } else {
              navigate("/no-access");
            }
            setLoginSuccessful(true);
          }
        }
      } else {
        // No password change required
        console.log("🏠 Redirecting to dashboard...");
        const accessibleRoutes = getAccessibleRoutes();
        if (accessibleRoutes.length > 0) {
          navigate(accessibleRoutes[0]);
        } else {
          navigate("/no-access");
        }
        setLoginSuccessful(true);
      }
    } catch (err) {
      console.error("❌ Error details:", {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        config: {
          url: err.config?.url,
          method: err.config?.method,
          data: err.config?.data
        }
      });

      // ✅ Enhanced error handling based on backend response structure
      let errorMessage = isSignUp ? "Registration failed. Please check your information." : "Login failed. Please check your credentials.";
      
      if (err.response?.data) {
        const errorData = err.response.data;
        
        // ✅ Handle field-specific validation errors
        if (errorData.phone_number) {
          const phoneError = Array.isArray(errorData.phone_number) ? errorData.phone_number[0] : errorData.phone_number;
          errorMessage = `Phone number: ${phoneError}`;
        } else if (errorData.email) {
          const emailError = Array.isArray(errorData.email) ? errorData.email[0] : errorData.email;
          errorMessage = `Email: ${emailError}`;
        } else if (errorData.password) {
          const passwordError = Array.isArray(errorData.password) ? errorData.password[0] : errorData.password;
          errorMessage = `Password: ${passwordError}`;
        } else if (errorData.first_name) {
          const nameError = Array.isArray(errorData.first_name) ? errorData.first_name[0] : errorData.first_name;
          errorMessage = `First name: ${nameError}`;
        } else if (errorData.last_name) {
          const nameError = Array.isArray(errorData.last_name) ? errorData.last_name[0] : errorData.last_name;
          errorMessage = `Last name: ${nameError}`;
        } else if (errorData.non_field_errors && errorData.non_field_errors.length > 0) {
          errorMessage = errorData.non_field_errors[0];
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
        // ✅ Handle generic validation errors
        else if (typeof errorData === 'object') {
          // Get the first error from any field
          const firstFieldError = Object.values(errorData)[0];
          if (Array.isArray(firstFieldError) && firstFieldError.length > 0) {
            errorMessage = firstFieldError[0];
          }
        }
      } else if (err.request) {
        errorMessage = "Unable to connect to server. Please check your internet connection.";
      }

      console.error("📢 Showing error to user:", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // **useEffect to redirect after login**
  useEffect(() => {
    if (loginSuccessful) {
      const accessibleRoutes = getAccessibleRoutes();
      if (accessibleRoutes.length > 0) {
        navigate(accessibleRoutes[0]);
      } else {
        navigate("/no-access");
      }
    }
  }, [loginSuccessful, navigate]);

  // Reset form fields when switching between SignIn/SignUp
  useEffect(() => {
    if (!isSignUp) {
      setSubmitted(false);
      setPhoneNumber("");
      setPassword("");
      setConfirmPassword("");
      setFirstName("");
      setLastName("");
      setGender("");
      setEmail("");
      setError("");
      setPasswordValid(false);
      setPasswordError("");
    }
  }, [isSignUp]);

  // Phone number validation
  const handlePhoneNumberChange = (e) => {
    const value = e.target.value;
    if (/^[0-9]*$/.test(value)) {
      setPhoneNumber(value);
    }
  };

  const logoSrc = process.env.PUBLIC_URL + "/static/images/Wilfie's 5.png";

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-700 rounded-full blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute -bottom-32 -right-24 w-80 h-80 bg-red-800 rounded-full blur-3xl opacity-25 animate-pulse"></div>

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="rounded-3xl bg-white/10 backdrop-blur-md shadow-2xl p-10 border border-white/20">
          <div className="flex flex-col items-center mb-6">
            <div className="w-52 h-52 rounded-full bg-white flex items-center justify-center mb-4">
              <img src={logoSrc} alt="Logo" className="w-80 h-80 rounded-full object-cover mb-1" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-1">
              {isSignUp ? "Create Account" : "Welcome back"}
            </h1>
            <p className="text-sm text-gray-200 text-center">
              {isSignUp ? "Sign up to get started" : "Sign in to Continue"}
            </p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/20 border border-red-700 text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {isSignUp ? (
              <>
                {/* Sign Up Form */}
                <div className="grid grid-cols-2 gap-4">
                  {/* First Name and Last Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">First Name *</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First Name"
                      required
                      className="w-full rounded-xl border border-gray-400/50 px-4 py-3 text-base text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 bg-white/10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">Last Name *</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last Name"
                      required
                      className="w-full rounded-xl border border-gray-400/50 px-4 py-3 text-base text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 bg-white/10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Gender and Phone Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">Gender *</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      required
                      className="w-full rounded-xl border border-gray-400/50 px-4 py-3 text-base text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 bg-gray-800 hover:bg-gray-700 transition-colors duration-300"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">Phone Number *</label>
                    <input
                      type="text"
                      value={phoneNumber}
                      onChange={handlePhoneNumberChange}
                      placeholder="Enter phone number"
                      required
                      className="w-full rounded-xl border border-gray-400/50 px-4 py-3 text-base text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 bg-white/10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Password and Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">Password *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={handlePasswordChange}
                        placeholder="••••••••"
                        required
                        className="w-full rounded-xl border border-gray-400/50 px-4 py-3 text-base text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 bg-white/10"
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
                    {!passwordValid && password && (
                      <div className="text-sm text-red-500 mt-1">{passwordError}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">Confirm Password *</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full rounded-xl border border-gray-400/50 px-4 py-3 text-base text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 bg-white/10"
                    />
                  </div>
                </div>

                {/* Email (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Email (Optional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email (Optional)"
                    className="w-full rounded-xl border border-gray-400/50 px-4 py-3 text-base text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 bg-white/10"
                  />
                </div>
              </>
            ) : (
              <>
                {/* Sign In Fields */}
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Phone Number</label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={handlePhoneNumberChange}
                    placeholder="Enter phone number"
                    required
                    className="w-full rounded-xl border border-gray-400/50 px-4 py-3 text-base text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 bg-white/10"
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
                      className="w-full rounded-xl border border-gray-400/50 px-4 py-3 text-base text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 bg-white/10"
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
              </>
            )}

            <div className="flex items-center justify-between">
              {/* Conditionally display the 'Remember me' checkbox only during Sign In */}
              {!isSignUp && (
                <label className="inline-flex items-center gap-2 text-sm text-gray-200 select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-400"
                  />
                  <span>Remember me</span>
                </label>
              )}

              {!isSignUp && (
                <p
                  className="text-sm text-red-400 hover:underline cursor-pointer"
                  onClick={() => setShowForgotModal(true)}
                >
                  Forgot password?
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || (isSignUp && !passwordValid)}
              className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-semibold transition-all ${loading
                ? "bg-red-700/80 text-white cursor-wait"
                : "bg-red-600 text-white hover:bg-red-700"
              }`}
            >
              {loading && <Spinner size={4} />}
              <span>
                {loading ? (isSignUp ? "Creating account..." : "Signing in...") : isSignUp ? "Sign up" : "Sign in"}
              </span>
            </button>

            <div className="mt-8 border-t border-white/20 pt-5 text-center">
              <p className="text-sm text-gray-200">
                {isSignUp ? (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setIsSignUp(false)}
                      className="text-red-400 font-semibold hover:text-red-600 hover:underline"
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setIsSignUp(true)}
                      className="text-red-400 font-semibold hover:text-red-600 hover:underline"
                    >
                      Sign up
                    </button>
                  </>
                )}
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <ForgotPasswordModal
          onClose={() => setShowForgotModal(false)}
          onOtpSent={() => {
            setOtpMode("forgot");
            setShowVerifyOTPModal(true);
          }}
        />
      )}

      {/* OTP Modal (shared for forgot + signup) */}
      {showVerifyOTPModal && (
        <VerifyOTPModal
          mode={otpMode}
          phone={otpMode === "signup" ? signupPhone : localStorage.getItem("resetPhoneNumber")}
          onClose={() => setShowVerifyOTPModal(false)}
          onVerified={handleOtpVerified}
        />
      )}
    </div>
  );
};

export default Login;