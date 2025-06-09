import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
  e.preventDefault();
  setError('');

  try {
    const res = await axios.post('http://localhost:8080/api/login/', {
      username,
      password,
    });

    const { role } = res.data;

    // ✅ Store in localStorage
    localStorage.setItem('user', JSON.stringify(res.data));
    localStorage.setItem('access', JSON.stringify(res.data.accessibilities));

    // Redirect based on role
    switch (role?.toLowerCase()) {
      case 'admin':
        navigate('/admin-dashboard');
        break;
      case 'cashier':
        navigate('/cashier-dashboard');
        break;
      case 'manager':
        navigate('/manager-dashboard');
        break;
      default:
        navigate('/user-dashboard');
    }
  } catch (err) {
    if (err.response?.data?.non_field_errors) {
      setError(err.response.data.non_field_errors[0]);
    } else {
      setError('Login failed. Please check your credentials.');
    }
  }
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleLogin}
        className="bg-white p-8 rounded shadow-md w-full max-w-sm"
      >
        <h2 className="text-2xl font-semibold mb-6 text-center">Login</h2>

        {error && (
          <div className="text-red-500 mb-4 text-center text-sm">{error}</div>
        )}

        <input
          type="text"
          placeholder="Username"
          className="w-full p-2 border rounded mb-4"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 border rounded mb-6"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
        >
          Login
        </button>
      </form>
    </div>
  );
};

export default Login;
