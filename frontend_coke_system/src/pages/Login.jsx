import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axios.post("http://localhost:8080/api/login/", {
        username,
        password,
      });

      const { role, must_change_password, id } = res.data;

      localStorage.setItem("user", JSON.stringify(res.data));
      localStorage.setItem("access", JSON.stringify(res.data.accessibilities));

      if (must_change_password) {
        navigate("/change-password", { state: { userId: id } });
      } else {
        switch (role?.toLowerCase()) {
          case "admin":
            navigate("/admin-dashboard");
            break;
          case "cashier":
            navigate("/cashier-dashboard");
            break;
          case "manager":
            navigate("/manager-dashboard");
            break;
          default:
            navigate("/user-dashboard");
        }
      }
    } catch (err) {
      if (err.response?.data?.non_field_errors) {
        setError(err.response.data.non_field_errors[0]);
      } else {
        setError("Login failed. Please check your credentials.");
      }
    }
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans">
      {/* Left - Welcome Panel */}
      <div className="w-1/2 bg-white relative flex items-center justify-center overflow-hidden">
        <div className="absolute right-0 top-0 h-full w-[4px] bg-gradient-to-b from-pink-500 via-red-400 to-orange-300 z-10" />
        <div className="z-20 text-center">
          <h1 className="text-5xl font-extrabold text-pink-600 mb-2 tracking-wide">WELCOME !</h1>
          <p className="text-gray-500 text-md">Log in to continue</p>
        </div>
        <div className="absolute inset-0 z-0">
          <div className="absolute top-6 left-10 w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 shadow-lg animate-float" />
          <div className="absolute top-[-50px] right-[-50px] w-64 h-64 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 shadow-lg animate-float" />
          <div className="absolute top-1/3 left-20 w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 shadow-lg animate-float" />
          <div className="absolute top-[70%] right-[15%] w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 shadow-lg animate-float" />
          <div className="absolute bottom-3 right-3 w-3 h-3 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 shadow-lg animate-float" />
          <div className="absolute bottom-[30%] left-[45%] w-4 h-4 rounded-full bg-pink-300 animate-float" />
          <div className="absolute top-[10%] right-[25%] w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 shadow-md animate-float" />
          <div className="absolute bottom-[15%] left-[15%] w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 shadow-md animate-float" />
          <div className="absolute top-[60%] left-[60%] w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 shadow-md animate-float" />
          <div className="absolute top-1/2 right-8 w-32 h-32 rounded-full border-[6px] border-transparent animate-float" style={{ borderImage: "linear-gradient(to bottom right, #ec4899, #ef4444, #f59e0b) 1" }} />
          <div className="absolute bottom-[-20px] left-[-20px] w-28 h-28 rounded-full border-[6px] border-transparent animate-float" style={{ borderImage: "linear-gradient(to bottom right, #ec4899, #ef4444, #f59e0b) 1" }} />
          <div className="absolute top-[25%] left-[75%] w-20 h-20 rounded-full border-[5px] border-transparent animate-float" style={{ borderImage: "linear-gradient(to bottom right, #ec4899, #ef4444, #f59e0b) 1" }} />
          <div className="absolute bottom-[10%] right-[35%] w-16 h-16 rounded-full border-[5px] border-transparent animate-float" style={{ borderImage: "linear-gradient(to bottom right, #ec4899, #ef4444, #f59e0b) 1" }} />
          <div className="absolute top-[40%] left-[10%] w-10 h-10 bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400 rotate-12 shadow-md animate-float" />
          <div className="absolute bottom-[20%] right-[10%] w-8 h-8 bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400 rotate-45 shadow-md animate-float" />
          <div className="absolute top-[15%] right-[40%] w-6 h-6 bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400 rotate-[30deg] shadow-md animate-float" />
        </div>
      </div>

      {/* Right - Login Form */}
    
<div className="w-1/2 bg-[#0e121e] relative flex items-center justify-center p-10 text-white overflow-hidden">



  {/* Form Card */}
  <form onSubmit={handleLogin} className="w-full max-w-sm z-10 mt-10">
    <img
  src="/static/images/Wilfie’s 5.png"
  alt="Logo"
  className="w-[220px] h-[220px] object-contain mx-auto mb-6 drop-shadow"

  ></img>
    <h2 className="text-5xl font-bold mb-8 text-white tracking-wider font-sans text-center drop-shadow-md">
      Login
    </h2>

    {error && (
      <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4 text-sm shadow">
        {error}
      </div>
    )}

    <input
      type="text"
      placeholder="Username"
      className="w-full px-4 py-3 mb-4 rounded bg-white text-black focus:outline-none shadow"
      value={username}
      onChange={(e) => setUsername(e.target.value)}
      required
    />

    <input
      type="password"
      placeholder="Password"
      className="w-full px-4 py-3 mb-4 rounded bg-white text-black focus:outline-none shadow"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      required
    />

    <p
      className="text-sm mb-4 text-right hover:underline cursor-pointer text-gray-300"
      onClick={() => navigate("/forgot-password")}
    >
      Forgot your password?
    </p>

    <button
      type="submit"
      className="w-full py-3 rounded bg-red-600 text-white font-bold hover:bg-white hover:text-red-600 border-2 border-red-600 transition-all"
    >
      Log In
    </button>

  </form>

  {/* Bubbles and Circles */}
  <div className="absolute -bottom-10 left-5 w-24 h-24 bg-red-600 rounded-full opacity-10 animate-ping" />
  <div className="absolute top-10 right-10 w-20 h-20 bg-white rounded-full opacity-5 animate-pulse" />
  <div className="absolute bottom-[25%] right-[20%] w-12 h-12 bg-red-600 rounded-full opacity-20 animate-bounce" />
</div>

    </div>
  );
};

export default Login;
