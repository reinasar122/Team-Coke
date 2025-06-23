import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import WifiLoader from '../components/WifiLoader'; // Adjust path as needed

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setMessage('');
    setSuccess(false);
    setLoading(true);

    try {
      await axios.post('http://localhost:8080/api/forgot-password/send-otp/', { email });
      localStorage.setItem('resetEmail', email);
      setSuccess(true);
      setMessage('OTP sent successfully. Please check your email.');

      setTimeout(() => {
        setLoading(false);
        navigate('/verify-otp');
      }, 1500);
    } catch (err) {
      setLoading(false);
      setMessage('Failed to send OTP. Please check the email.');
    }
  };

  const checkmarkStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: 100,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '6rem',
    color: '#3B82F6', // soft blue
    fontWeight: 'bold',
    animation: 'bounceCheck 0.5s ease-out',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 via-white to-gray-200 p-4 font-sans">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md relative z-10 border border-gray-200">
        <h2 className="text-3xl font-extrabold text-center text-gray-700 mb-4">Forgot Password</h2>
        <p className="text-center text-gray-500 text-sm mb-6">
          Enter your email address to receive a one-time (OTP) to reset the password.
        </p>

        <form onSubmit={handleSendOTP}>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            placeholder="e.g. example@email.com"
            className="w-full border border-gray-300 rounded-md px-4 py-2 mb-4 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md transition duration-200 shadow-sm"
          >
            Send OTP
          </button>

          {message && (
            <p
              className={`text-sm text-center mt-4 font-medium ${
                message.toLowerCase().includes('failed') ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {message}
            </p>
          )}
        </form>
      </div>

      {/* Loader or success checkmark */}
      {loading && (success ? <div style={checkmarkStyle}>✔</div> : <WifiLoader />)}

      <style>
        {`
          @keyframes bounceCheck {
            0% { transform: scale(0.3); opacity: 0; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); }
          }
        `}
      </style>
    </div>
  );
};

export default ForgotPassword;
