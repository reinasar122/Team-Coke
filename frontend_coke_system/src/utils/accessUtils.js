// src/utils/accessUtils.js

import { routeMap, routeOrder } from "../utils/routeMap";

const getAccessList = () => {
  try {
    const rawAccess = localStorage.getItem("access");
    const parsedAccess = JSON.parse(rawAccess || "[]");
    return Array.isArray(parsedAccess) ? parsedAccess : [];
  } catch (error) {
    console.error("Failed to parse access list from localStorage:", error);
    return [];
  }
};

const getStoredRole = () => {
  try {
    const rawUser = localStorage.getItem("user");
    const parsedUser = JSON.parse(rawUser || "{}");
    return String(
      parsedUser?.role_name ||
      parsedUser?.role?.name ||
      parsedUser?.role ||
      ""
    )
      .trim()
      .toLowerCase();
  } catch (error) {
    console.error("Failed to parse user role from localStorage:", error);
    return "";
  }
};

// Check if the user has access to a submenu
export const hasAccess = (submenu) => {
  const accessList = getAccessList();
  return accessList.some(
    (access) => access.submenu === submenu && (access.full || access.view)
  );
};

export const getAllowedSubmenus = () => {
  const accessList = getAccessList();
  const allowed = new Set(
    accessList
      .filter((acc) => acc.full || acc.view)
      .map((acc) => acc.submenu)
  );

  return routeOrder.filter((submenu) => allowed.has(submenu) && routeMap[submenu]);
};

// Get all allowed route paths based on the user's permissions
export const getAllowedRoutes = () =>
  getAllowedSubmenus().map((submenu) => routeMap[submenu]).filter(Boolean);

export const getDefaultAccessibleRoute = (excludeRoutes = []) => {
  const excludeSet = new Set(
    (Array.isArray(excludeRoutes) ? excludeRoutes : [excludeRoutes]).filter(Boolean)
  );

  const allowedSubmenus = getAllowedSubmenus();
  const storedRole = getStoredRole();

  if (
    storedRole === "cashier" &&
    allowedSubmenus.includes("Trading") &&
    !excludeSet.has("/trading")
  ) {
    return "/trading";
  }

  return getAllowedRoutes().find((route) => !excludeSet.has(route)) || null;
};
