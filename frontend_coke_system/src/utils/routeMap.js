// src/utils/routeMap.js

// Ordered list of submenus (same sequence as Sidebar)
export const routeOrder = [
  "Dashboard",

  // Transactions
  "Receiving",
  "Trading",
  "Supplier Return",
  "Invoice",
  "Credit",
  "Expenses",

  // Inventory
  "Stocks",
  "Product",
  "Returned Empties",

  // Reports
  "Sales Report",
  "Inventory Report",

  // Manage
  "User",
  "Roles",
  "Warehouse",
  "Supplier",
  "Van",
  "Customer",
  
  // Settings
  "Settings",
];

// Map submenus to routes
export const routeMap = {
  Dashboard: "/dashboard",
  Receiving: "/receiving",
  Trading: "/trading",
  "Supplier Return": "/supplier-returns",
  Invoice: "/invoice",
  Credit: "/credits",
  Expenses: "/expenses",
  Stocks: "/stocks",
  Product: "/products",
  "Returned Empties": "/return-empties",
  "Sales Report": "/reports/sales",
  "Inventory Report": "/reports/inventory",
  User: "/users",
  Roles: "/roles",
  Warehouse: "/warehouses",
  Supplier: "/suppliers",
  Van: "/vans",
  Settings: "/settings",
};