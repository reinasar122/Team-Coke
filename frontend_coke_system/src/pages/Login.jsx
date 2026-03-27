// ✅ Login.jsx (ENHANCED + FIXED)
// - Phone number: numbers only + limit 11 digits (Sign in + Sign up)
// - Recent dropdown: shows ONLY when matches exist + "Recent" header + "Clear" button + highlight match
// - Remember me: actually remembers the phone after logout/refresh
// - Better UX: loading overlay, card entrance animation, error shake, improved focus glow
// - Eye button: bigger click area + prevents weird overlay spacing (duplicate eye fix needs CSS below)

import React, { useState, useEffect, useRef } from "react";
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

// ✅ highlight helper for dropdown
const HighlightMatch = ({ text, match }) => {
  if (!match) return <span>{text}</span>;
  if (!text.startsWith(match)) return <span>{text}</span>;
  return (
    <span>
      <span className="text-white font-semibold">{match}</span>
      <span className="text-gray-300">{text.slice(match.length)}</span>
    </span>
  );
};

const Login = () => {
  // When we display the login/sign‑up page we want the appearance to stay
  // light even if the rest of the app is in dark mode.  The global theme is
  // applied by toggling the `dark` class on <html> (see tailwind config).  This
  // component temporarily removes that class to keep all nested CSS in the
  // light state.  We remember the previous value so it can be restored once the
  // user navigates away.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const hadDarkHtml = html.classList.contains("dark");
    const hadDarkBody = body.classList.contains("dark");
    if (hadDarkHtml) html.classList.remove("dark");
    if (hadDarkBody) body.classList.remove("dark");
    html.dataset.prevDark = hadDarkHtml ? "true" : "false";
    body.dataset.prevDark = hadDarkBody ? "true" : "false";
    return () => {
      if (html.dataset.prevDark === "true") html.classList.add("dark");
      if (body.dataset.prevDark === "true") body.classList.add("dark");
      delete html.dataset.prevDark;
      delete body.dataset.prevDark;
    };
  }, []);

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

  // ✅ Remember Me
  const [remember, setRemember] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const [loading, setLoading] = useState(false);
  const [loginSuccessful, setLoginSuccessful] = useState(false);

  const [showRecentNumbers, setShowRecentNumbers] = useState(false);
  const [recentNumbers, setRecentNumbers] = useState([]);
  const [filteredRecentNumbers, setFilteredRecentNumbers] = useState([]);

  const [capsLockOn, setCapsLockOn] = useState(false);

  const navigate = useNavigate();

  // OTP mode + phone for signup verification
  const [otpMode, setOtpMode] = useState("forgot");
  const [signupPhone, setSignupPhone] = useState("");

  const recentNumbersRef = useRef(null);
  const signInPasswordRef = useRef(null);

  // ✅ Load recent numbers on mount
  useEffect(() => {
    const stored = localStorage.getItem("recentPhoneNumbers");
    if (stored) setRecentNumbers(JSON.parse(stored));
  }, []);

  // ✅ Remember Me: load preference + phone on mount
  useEffect(() => {
    const rememberFlag = localStorage.getItem("rememberMe") === "true";
    setRemember(rememberFlag);

    if (rememberFlag) {
      const savedPhone = localStorage.getItem("rememberPhoneNumber") || "";
      if (savedPhone) setPhoneNumber(savedPhone);
    }
  }, []);

  // Keep password blank on fresh page load (browser/password manager may try to autofill it).
  useEffect(() => {
    const clearAutofilledPassword = () => {
      setPassword("");
      if (signInPasswordRef.current) signInPasswordRef.current.value = "";
    };

    clearAutofilledPassword();
    const t1 = setTimeout(clearAutofilledPassword, 120);
    const t2 = setTimeout(clearAutofilledPassword, 400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // ✅ Save recent numbers (top 5)
  const saveRecentNumber = (number) => {
    if (!number.trim()) return;
    const updated = [number, ...recentNumbers.filter((n) => n !== number)].slice(0, 5);
    setRecentNumbers(updated);
    localStorage.setItem("recentPhoneNumbers", JSON.stringify(updated));
  };

  // ✅ Clear recent numbers
  const clearRecentNumbers = () => {
    setRecentNumbers([]);
    setFilteredRecentNumbers([]);
    setShowRecentNumbers(false);
    localStorage.removeItem("recentPhoneNumbers");
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (recentNumbersRef.current && !recentNumbersRef.current.contains(e.target)) {
        setShowRecentNumbers(false);
      }
    };

    if (showRecentNumbers) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }
  }, [showRecentNumbers]);

  const getAccessibleRoutes = () => {
    const accessList = JSON.parse(localStorage.getItem("access") || "[]");
    const allowed = new Set(accessList.filter((acc) => acc.full || acc.view).map((acc) => acc.submenu));
    return routeOrder.filter((submenu) => allowed.has(submenu) && routeMap[submenu]);
  };

  const isDefaultAdmin = (user) => {
    const normalizedRole = String(user?.role || "").toLowerCase();
    const isAdminRole = ["admin", "administrator", "super admin"].includes(normalizedRole);
    if (!isAdminRole) return false;

    if (String(user?.phone_number || "").trim() === "09179902969") return true;
    if (Number(user?.id) === 1) return true;
    return false;
  };

  const handleOtpVerified = (encodedUid, token) => {
    setShowVerifyOTPModal(false);
    if (otpMode === "forgot" && encodedUid && token) {
      navigate(`/change-password/${encodedUid}/${token}`);
    } else if (otpMode === "signup") {
      const modal = document.createElement("div");
      modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
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

    const handleVerifyOtpClose = async () => {
    if (otpMode === "signup" && signupPhone) {
      try {
        await api.post("/cancel-phone-signup/", { phone_number: signupPhone });
      } catch (err) {
        // Best-effort cleanup only; backend now also allows retrying unverified signup.
        console.warn("Failed to cancel pending signup:", err?.response?.data || err.message);
      }
      localStorage.removeItem("signupPhone");
      setSignupPhone("");
    }

    setShowVerifyOTPModal(false);
  };
  // Password Complexity Validation
  const passwordComplexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
  const [passwordError, setPasswordError] = useState("");
  const [passwordValid, setPasswordValid] = useState(false);

  const checkPasswordValidity = (pwd) => {
    if (!pwd) {
      setPasswordValid(false);
      setPasswordError("");
      return;
    }
    if (!passwordComplexityRegex.test(pwd)) {
      setPasswordValid(false);
      setPasswordError(
        "Password must contain at least one uppercase letter, one lowercase letter, one special character, and be at least 8 characters long."
      );
    } else {
      setPasswordValid(true);
      setPasswordError("");
    }
  };

  const handlePasswordChange = (e) => {
    const v = e.target.value;
    setPassword(v);
    checkPasswordValidity(v);
  };

  const isValidEmail = (em) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);

  const handleCapsLock = (e) => {
    try {
      if (e && typeof e.getModifierState === "function") {
        setCapsLockOn(e.getModifierState("CapsLock"));
      }
    } catch (_) {}
  };

  // ✅ Phone input: numbers only + limit 11 digits + dropdown ONLY if match (Sign In)
  const handlePhoneNumberChange = (e) => {
    const value = e.target.value.replace(/\D/g, "");
    const limitedValue = value.slice(0, 11);

    setPhoneNumber(limitedValue);

    if (isSignUp) {
      setShowRecentNumbers(false);
      setFilteredRecentNumbers([]);
      return;
    }

    if (limitedValue.trim()) {
      const matches = recentNumbers.filter((n) => n.startsWith(limitedValue));
      setFilteredRecentNumbers(matches);
      setShowRecentNumbers(matches.length > 0);
    } else {
      setFilteredRecentNumbers([]);
      setShowRecentNumbers(false);
    }
  };

  const handleSelectRecentNumber = (number) => {
    setPhoneNumber(number);
    setFilteredRecentNumbers([]);
    setShowRecentNumbers(false);

    if (remember) localStorage.setItem("rememberPhoneNumber", number);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // ✅ Enhanced validation for signup
    if (isSignUp) {
      const errors = {};
      if (!phoneNumber.trim()) errors.phoneNumber = "Phone number is required";
      if (!password) errors.password = "Password is required";
      if (!confirmPassword) errors.confirmPassword = "Confirm your password";
      if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match";
      if (!passwordValid) errors.password = passwordError;
      if (!firstName.trim()) errors.firstName = "First name is required";
      if (!lastName.trim()) errors.lastName = "Last name is required";
      if (!gender) errors.gender = "Please select gender";
      if (email && !isValidEmail(email)) errors.email = "Invalid email format";

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setLoading(false);
        return;
      }
      setFieldErrors({});
    }

    const formData = isSignUp
      ? {
          phone_number: phoneNumber.trim(),
          password,
          confirm_password: confirmPassword,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          gender,
          ...(email.trim() && { email: email.trim() }),
        }
      : { phone_number: phoneNumber.trim(), password };

    try {
      const res = await api.post(isSignUp ? "/register/" : "/login/", formData);

      if (isSignUp) {
        const signupPhoneNumber = phoneNumber.trim();
        setSignupPhone(signupPhoneNumber);
        localStorage.setItem("signupPhone", signupPhoneNumber);
        setOtpMode("signup");
        setShowVerifyOTPModal(true);
        setLoading(false);
        return;
      }

      const { must_change_password, id, accessibilities } = res.data;

      // ✅ recent + remember phone
      saveRecentNumber(phoneNumber);

      if (remember) {
        localStorage.setItem("rememberPhoneNumber", phoneNumber.trim());
        localStorage.setItem("rememberMe", "true");
      } else {
        localStorage.removeItem("rememberPhoneNumber");
        localStorage.setItem("rememberMe", "false");
      }

      localStorage.setItem("user", JSON.stringify(res.data));
      localStorage.setItem("access", JSON.stringify(accessibilities));
        if (res.data?.warehouse_id) {
        localStorage.setItem(
          "selectedWarehouse",
          JSON.stringify({ id: res.data.warehouse_id, name: res.data.warehouse })
        );
      } else {
        localStorage.removeItem("selectedWarehouse");
      }
      localStorage.setItem("loginTime", Date.now().toString());
      window.dispatchEvent(new CustomEvent("userLoggedIn"));

      // ✅ Password change logic
      const userIsDefaultAdmin = isDefaultAdmin(res.data);

      const requiresPasswordChange = Boolean(
        must_change_password || res.data?.requires_password_change
      );

      if (requiresPasswordChange && userIsDefaultAdmin) {
        navigate(`/change-password/${id}`, { state: { userId: id } });
        return;
      }

      // ✅ just mark success and let effect redirect
      setLoginSuccessful(true);
    } catch (err) {
      let errorMessage = isSignUp
        ? "Registration failed. Please check your information."
        : "Login failed. Please check your credentials.";

      if (err.response?.data) {
        const d = err.response.data;
        if (d.phone_number) errorMessage = `Phone number: ${Array.isArray(d.phone_number) ? d.phone_number[0] : d.phone_number}`;
        else if (d.email) errorMessage = `Email: ${Array.isArray(d.email) ? d.email[0] : d.email}`;
        else if (d.password) errorMessage = `Password: ${Array.isArray(d.password) ? d.password[0] : d.password}`;
        else if (d.first_name) errorMessage = `First name: ${Array.isArray(d.first_name) ? d.first_name[0] : d.first_name}`;
        else if (d.last_name) errorMessage = `Last name: ${Array.isArray(d.last_name) ? d.last_name[0] : d.last_name}`;
        else if (d.non_field_errors?.length) errorMessage = d.non_field_errors[0];
        else if (d.error) errorMessage = d.error;
        else if (d.detail) errorMessage = d.detail;
        else if (typeof d === "string") errorMessage = d;
        else if (typeof d === "object") {
          const firstFieldError = Object.values(d)[0];
          if (Array.isArray(firstFieldError) && firstFieldError.length > 0) errorMessage = firstFieldError[0];
        }
      } else if (err.request) {
        errorMessage = "Unable to connect to server. Please check your internet connection.";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ✅ redirect after login success
  useEffect(() => {
    if (loginSuccessful) {
      const accessibleRoutes = getAccessibleRoutes();
      navigate(accessibleRoutes.length > 0 ? accessibleRoutes[0] : "/no-access");
    }
  }, [loginSuccessful, navigate]);

  // ✅ reset fields when switching modes
  useEffect(() => {
    if (!isSignUp) {
      const rememberFlag = localStorage.getItem("rememberMe") === "true";
      if (rememberFlag) {
        setPhoneNumber(localStorage.getItem("rememberPhoneNumber") || "");
      } else {
        setPhoneNumber("");
      }

      setPassword("");
      setConfirmPassword("");
      setFirstName("");
      setLastName("");
      setGender("");
      setEmail("");
      setError("");
      setPasswordValid(false);
      setPasswordError("");
      setShowRecentNumbers(false);
      setFilteredRecentNumbers([]);
    } else {
      // Keep sign-up phone input blank instead of carrying over the last login number.
      setPhoneNumber("");
      setShowRecentNumbers(false);
      setFilteredRecentNumbers([]);
    }
  }, [isSignUp]);

  const logoSrc = process.env.PUBLIC_URL + "/static/images/Wilfie’s 5.png";

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-700 rounded-full blur-3xl opacity-15 animate-pulse" />
      <div className="absolute -bottom-32 -right-24 w-80 h-80 bg-red-800 rounded-full blur-3xl opacity-10 animate-pulse" />

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* ✅ Entrance animation + error shake */}
        <div
          className={`relative rounded-3xl bg-white/10 backdrop-blur-md shadow-2xl border border-white/20
          animate-[fadeInUp_.55s_ease-out] ${error ? "animate-[shake_.35s_ease-in-out]" : ""} ${isSignUp ? "p-8" : "p-10"}`}
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

          <div className={`flex flex-col items-center ${isSignUp ? "mb-2" : "mb-6"}`}>
            <div className={`rounded-full bg-white flex items-center justify-center ${isSignUp ? "w-24 h-24 mb-2" : "w-52 h-52 mb-4"}`}>
              <img src={logoSrc} alt="Logo" className={`rounded-full object-cover ${isSignUp ? "w-32 h-32" : "w-80 h-80 mb-1"}`} />
            </div>
            <h1 className={`font-bold text-white mb-1 ${isSignUp ? "text-2xl" : "text-3xl"}`}>{isSignUp ? "Create Account" : "Welcome"}</h1>
            <p className={`text-gray-200 text-center ${isSignUp ? "text-xs" : "text-sm"}`}>{isSignUp ? "Sign up to get started" : "Sign in to Continue"}</p>
          </div>

          {error && (
            <div className={`px-4 py-3 rounded-lg bg-red-500/20 border border-red-700 text-red-200 text-sm ${isSignUp ? "mb-2" : "mb-4"}`}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className={`${isSignUp ? "space-y-3" : "space-y-5"}`} autoComplete="off">
            {!isSignUp && (
              <div className="sr-only" aria-hidden="true">
                <input type="text" name="fake-username" autoComplete="username" tabIndex={-1} />
                <input type="password" name="fake-password" autoComplete="current-password" tabIndex={-1} />
              </div>
            )}
            {isSignUp ? (
              <>
                {/* Sign Up Form */}
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={phoneNumber}
                    onChange={handlePhoneNumberChange}
                    placeholder="Enter phone number"
                    required
                    maxLength={11}
                    className="w-full rounded-xl border border-gray-400/50 px-4 py-2 text-base text-white placeholder-gray-300 bg-white/10
                    focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400
                    focus:shadow-[0_0_0_4px_rgba(59,130,246,0.15)] transition"
                  />
                  {fieldErrors.phoneNumber && <p className="text-red-400 text-sm mt-1">{fieldErrors.phoneNumber}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={handlePasswordChange}
                      placeholder="Enter password"
                      required
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-gray-400/50 px-4 py-3 pr-12 text-base text-white placeholder-gray-300 bg-white/10
                      focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400
                      focus:shadow-[0_0_0_4px_rgba(59,130,246,0.15)] transition"
                      style={showPassword ? { WebkitTextSecurity: "none" } : undefined}
                    />

                    {/* ✅ bigger click area */}
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-gray-200 hover:text-blue-400 transition"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {!showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                    </button>
                  </div>

                  {!passwordValid && password && <div className="text-sm text-red-500 mt-1">{passwordError}</div>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Confirm Password *</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      required
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-gray-400/50 px-4 py-3 pr-12 text-base text-white placeholder-gray-300 bg-white/10
                      focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400
                      focus:shadow-[0_0_0_4px_rgba(59,130,246,0.15)] transition"
                      style={showConfirmPassword ? { WebkitTextSecurity: "none" } : undefined}
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

                  {fieldErrors.confirmPassword && <p className="text-red-400 text-sm mt-1">{fieldErrors.confirmPassword}</p>}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">First Name *</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First Name"
                      required
                      className="w-full rounded-xl border border-gray-400/50 px-4 py-3 text-base text-white placeholder-gray-300 bg-white/10
                      focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400
                      focus:shadow-[0_0_0_4px_rgba(59,130,246,0.15)] transition"
                    />
                    {fieldErrors.firstName && <p className="text-red-400 text-sm mt-1">{fieldErrors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">Last Name *</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last Name"
                      required
                      className="w-full rounded-xl border border-gray-400/50 px-4 py-3 text-base text-white placeholder-gray-300 bg-white/10
                      focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400
                      focus:shadow-[0_0_0_4px_rgba(59,130,246,0.15)] transition"
                    />
                    {fieldErrors.lastName && <p className="text-red-400 text-sm mt-1">{fieldErrors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Gender *</label>
                  {/* custom dropdown with own arrow */}
                <div className="relative">
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    required
                    className="w-full rounded-xl border border-gray-400/50 px-4 py-2 pr-10 text-base text-white
                    focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400
                    bg-gray-800 hover:bg-gray-700 transition appearance-none"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {/* SVG arrow positioned over the right side */}
                  <svg
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
                  {fieldErrors.gender && <p className="text-red-400 text-sm mt-1">{fieldErrors.gender}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email (Optional)"
                    className="w-full rounded-xl border border-gray-400/50 px-4 py-2 text-base text-white placeholder-gray-300 bg-white/10
                    focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400
                    focus:shadow-[0_0_0_4px_rgba(59,130,246,0.15)] transition"
                  />
                  {fieldErrors.email && <p className="text-red-400 text-sm mt-1">{fieldErrors.email}</p>}
                </div>
              </>
            ) : (
              <>
                {/* Sign In Fields */}
                <div ref={recentNumbersRef} className="relative">
                  <label className="block text-sm font-medium text-gray-200 mb-2">Phone Number</label>
                  <input
                    type="text"
                    name="signin-phone"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    autoComplete="off"
                    value={phoneNumber}
                    onChange={handlePhoneNumberChange}
                    placeholder="Enter phone number"
                    required
                    maxLength={11}
                    className="w-full rounded-xl border border-gray-400/50 px-4 py-3 text-base text-white placeholder-gray-300 bg-white/10
                    focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400
                    focus:shadow-[0_0_0_4px_rgba(59,130,246,0.15)] transition"
                  />

                  {/* ✅ Dropdown with header + clear + highlighted match */}
                  {showRecentNumbers && filteredRecentNumbers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-gray-950/95 border border-gray-700 rounded-xl shadow-2xl z-10 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
                        <span className="text-xs text-gray-400">Recent</span>
                        <button
                          type="button"
                          onClick={clearRecentNumbers}
                          className="text-xs text-blue-400 hover:text-red-300 hover:underline"
                        >
                          Clear
                        </button>
                      </div>

                      {filteredRecentNumbers.map((number, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectRecentNumber(number)}
                          className="w-full text-left px-4 py-2 text-gray-200 hover:bg-blue-600/20 transition-colors"
                        >
                          <HighlightMatch text={number} match={phoneNumber} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Password</label>
                  <div className="relative">
                    <input
                      ref={signInPasswordRef}
                      name="signin-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleCapsLock}
                      onKeyUp={handleCapsLock}
                      onFocus={handleCapsLock}
                      onBlur={() => setCapsLockOn(false)}
                      placeholder="Enter password"
                      required
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      className="w-full rounded-xl border border-gray-400/50 px-4 py-3 pr-12 text-base text-white placeholder-gray-300 bg-white/10
                      focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400
                      focus:shadow-[0_0_0_4px_rgba(59,130,246,0.15)] transition"
                      style={showPassword ? { WebkitTextSecurity: "none" } : undefined}
                    />

                    {/* ✅ bigger click area */}
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-gray-200 hover:text-blue-400 transition"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {!showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                    </button>
                  </div>

                  {capsLockOn && <p className="mt-1 text-xs text-white">Caps Lock is on</p>}
                </div>
              </>
            )}

            <div className="flex items-center justify-between">
              {!isSignUp && (
                <label className="inline-flex items-center gap-2 text-sm text-gray-200 select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setRemember(checked);

                      localStorage.setItem("rememberMe", checked ? "true" : "false");

                      if (!checked) {
                        localStorage.removeItem("rememberPhoneNumber");
                      } else {
                        if (phoneNumber.trim()) localStorage.setItem("rememberPhoneNumber", phoneNumber.trim());
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-400"
                  />
                  <span>Remember me</span>
                </label>
              )}

              {!isSignUp && (
                <p className="text-sm text-blue-400 hover:underline cursor-pointer" onClick={() => setShowForgotModal(true)}>
                  Forgot password?
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || (isSignUp && !passwordValid)}
              className={`w-full flex items-center justify-center gap-3 px-6 rounded-xl font-semibold transition-all ${isSignUp ? "py-2" : "py-3"}
              ${loading ? "bg-blue-600/80 text-white cursor-wait" : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg"}`}
            >
              <span>{loading ? (isSignUp ? "Creating account..." : "Signing in...") : isSignUp ? "Sign up" : "Sign in"}</span>
            </button>

            <div className={`border-t border-white/20 text-center ${isSignUp ? "mt-3 pt-3" : "mt-8 pt-5"}`}>
              <p className="text-sm text-gray-200">
                {isSignUp ? (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setIsSignUp(false)}
                      className="text-blue-400 font-semibold hover:text-blue-300 hover:underline"
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
                      className="text-blue-400 font-semibold hover:text-blue-300 hover:underline"
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

      {/* OTP Modal */}
      {showVerifyOTPModal && (
        <VerifyOTPModal
          mode={otpMode}
          phone={otpMode === "signup" ? signupPhone : localStorage.getItem("resetPhoneNumber")}
          onClose={handleVerifyOtpClose}
          onVerified={handleOtpVerified}
        />
      )}
    </div>
  );
};

export default Login;
