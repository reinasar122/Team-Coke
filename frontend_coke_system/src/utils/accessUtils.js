// src/utils/accessUtils.js

import { routeMap, routeOrder } from "../utils/routeMap";  // Import the routeOrder and routeMap

// Check if the user has access to a submenu
export const hasAccess = (submenu) => {
  const accessList = JSON.parse(localStorage.getItem("access") || "[]");
  return accessList.some((access) => access.submenu === submenu && access.view);
};

// Get all allowed routes based on the user's permissions
export const getAllowedRoutes = () => {
  const accessList = JSON.parse(localStorage.getItem("access") || "[]");
  const allowed = new Set(
    accessList.filter((acc) => acc.full || acc.view).map((acc) => acc.submenu)
  );

  // Return all routes that the user has access to
  return routeOrder.filter((submenu) => allowed.has(submenu) && routeMap[submenu]);
};