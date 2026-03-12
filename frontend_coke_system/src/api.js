import axios from "axios";

const api = axios.create({
  //baseURL: process.env.REACT_APP_API_BASE || "/coke/api",
  baseURL: process.env.REACT_APP_API_BASE || "http://localhost:8080/api",
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, error => Promise.reject(error));

export default api;
