// src/utils/accessControl.js

export const getAccessMap = () => {
  try {
    const accessList = JSON.parse(localStorage.getItem("access") || "[]");
    const map = {};
    accessList.forEach(({ submenu, full, view, create, edit, delete: del }) => {
      map[submenu] = {
        full: full || false,
        view: view || false,
        create: create || false,
        edit: edit || false,
        delete: del || false,
      };
    });
    return map;
  } catch (err) {
    console.error("Failed to parse access from localStorage:", err);
    return {};
  }
};

export const canView = (submenuName) => {
  const access = getAccessMap();
  return access[submenuName]?.full || access[submenuName]?.view || false;
};

export const canCreate = (submenuName) => {
  const access = getAccessMap();
  return access[submenuName]?.full || access[submenuName]?.create || false;
};

export const canEdit = (submenuName) => {
  const access = getAccessMap();
  return access[submenuName]?.full || access[submenuName]?.edit || false;
};

export const canDelete = (submenuName) => {
  const access = getAccessMap();
  return access[submenuName]?.full || access[submenuName]?.delete || false;
};

export const hasFullAccess = (submenuName) => {
  const access = getAccessMap();
  return access[submenuName]?.full || false;
};
