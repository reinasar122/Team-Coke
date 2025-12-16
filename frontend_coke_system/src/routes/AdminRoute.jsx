import { Navigate } from "react-router-dom";

export default function AdminRoute({ children }) {
  const user = JSON.parse(localStorage.getItem("user"));

  const roleName =
    user?.role_name ||
    user?.role?.name ||
    user?.role ||
    "";

  const isAdmin = roleName.toLowerCase() === "admin";

  return isAdmin ? children : <Navigate to="/unauthorized" replace />;
}