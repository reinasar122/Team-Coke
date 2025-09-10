import React from "react";

const PermissionTable = ({ modules, permissions, onFullToggle, onToggle }) => {
  return (
    <div className="table table-hover">
      <table className="min-w-full text-sm border border-gray-300 rounded-md">
        <thead className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wide">
          <tr>
            <th className="px-4 py-2 text-left">Menu</th>
            <th className="px-4 py-2 text-left">Submenu</th>
            <th className="px-4 py-2 text-center">Full</th>
            <th className="px-4 py-2 text-center">View</th>
            <th className="px-4 py-2 text-center">Create</th>
            <th className="px-4 py-2 text-center">Edit</th>
            <th className="px-4 py-2 text-center">Delete</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(modules).map(([menu, submenus]) =>
            submenus.map((submenu, index) => (
              <tr key={submenu} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                {index === 0 && (
                  <td
                    rowSpan={submenus.length}
                    className="px-4 py-2 font-semibold border-r border-gray-300 align-top"
                  >
                    {menu}
                  </td>
                )}
                <td className="px-4 py-2 font-medium">{submenu}</td>
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={permissions[submenu]?.full_access || false}
                    onChange={() => onFullToggle(submenu)}
                  />
                </td>
                {["view", "create", "edit", "delete"].map((perm) => (
                  <td key={perm} className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={permissions[submenu]?.[perm] || false}
                      onChange={() => onToggle(submenu, perm)}
                      disabled={permissions[submenu]?.full_access}
                    />
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default PermissionTable;