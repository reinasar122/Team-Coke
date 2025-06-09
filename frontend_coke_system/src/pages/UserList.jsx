import { useState, useEffect } from "react";
import UserForm from "./UserForm";
import EditUser from "./EditUser";
import { canCreate, canEdit, canDelete } from "../utils/accessControl";

// Search Icon Component
const SearchIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 transition-all duration-200"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M8.5 3a5.5 5.5 0 104.34 9.156l3.685 3.685a1 1 0 101.414-1.414l-3.685-3.685A5.5 5.5 0 008.5 3zM5 8.5a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z"
      clipRule="evenodd"
    />
  </svg>
);

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [selectedRole, setSelectedRole] = useState("All Users");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8080/api/users/");
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8080/api/roles/");
      const data = await response.json();
      setRoles(data);
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  const handleUserUpdated = (updatedUser) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) => (user.id === updatedUser.id ? updatedUser : user))
    );
    setEditingUser(null);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await fetch(`http://127.0.0.1:8080/api/users/${userToDelete.id}/`, {
        method: "DELETE",
      });
      setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userToDelete.id));
      setShowDeleteModal(false);
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const uniqueRoles = ["All Users", ...roles.map((role) => role.name)];

  const filteredUsers = users
    .filter((user) =>
      (selectedRole === "All Users" || user.role_name === selectedRole) &&
      (user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.last_name.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => a.first_name.localeCompare(b.first_name));

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-4 sm:mb-0">
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="text-2xl font-semibold flex items-center gap-2 bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              {selectedRole}
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 mt-2 w-40 bg-white shadow-lg rounded-md border z-10">
                {uniqueRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      setSelectedRole(role);
                      setDropdownOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    {role}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative flex-1">
            {!isFocused && <SearchIcon />}
            <input
              type="text"
              placeholder="Search a name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(searchTerm.length > 0)}
              className={`pl-10 pr-6 py-2 border rounded-lg bg-gray-100 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                isFocused ? "pl-3 w-full sm:w-auto" : "w-60 sm:w-auto"
              }`}
            />
          </div>
        </div>

        <button
          className={`px-4 py-2 rounded-lg ${
            canCreate("User") ? "bg-red-500 text-white hover:bg-red-600" : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
          onClick={() => {
            if (canCreate("User")) setShowForm(true);
          }}
        >
          + Create User
        </button>
      </div>

      <div className="overflow-x-auto w-full bg-white shadow-md rounded-lg">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-200 text-left">
            <tr>
              <th className="py-3 px-4">USER DETAILS</th>
              <th className="py-3 px-4">ROLE</th>
              <th className="py-3 px-4">WAREHOUSE</th>
              <th className="py-3 px-4">STATUS</th>
              <th className="py-3 px-4 text-center">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <tr key={user.id} className="border-t hover:bg-gray-100">
                  <td className="py-3 px-4 flex items-center">
                    <div className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-black bg-gray-100">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M12 2a5 5 0 015 5v1a5 5 0 01-10 0V7a5 5 0 015-5zm-7 17a7 7 0 0114 0v1a1 1 0 01-1 1H6a1 1 0 01-1-1v-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <span className="text-blue-600 font-medium">{user.first_name} {user.last_name}</span>
                      <br />
                      <small className="text-gray-500">{user.email}</small>
                    </div>
                  </td>
                  <td className="py-3 px-4">{user.role_name}</td>
                  <td className="py-3 px-4">{user.warehouse_name}</td>
                  <td className="py-3 px-4">
                    {user.is_active ? (
                      <span className="bg-green-100 text-green-600 px-2 py-1 rounded-md text-sm font-medium">Active</span>
                    ) : (
                      <span className="bg-red-100 text-red-600 px-2 py-1 rounded-md text-sm font-medium">Inactive</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center space-x-2">
                    <button
                      onClick={() => canEdit("User") && setEditingUser(user)}
                      className={`px-3 py-1 rounded ${
                        canEdit("User")
                          ? "bg-yellow-500 text-white hover:bg-yellow-600"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (canDelete("User")) {
                          setUserToDelete(user);
                          setShowDeleteModal(true);
                        }
                      }}
                      className={`px-3 py-1 rounded ${
                        canDelete("User")
                          ? "bg-red-500 text-white hover:bg-red-600"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="5" className="py-6 text-center">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
          <UserForm onUserAdded={(newUser) => setUsers([...users, newUser])} onClose={() => setShowForm(false)} />
        </div>
      )}

      {editingUser && (
        <EditUser
          userId={editingUser.id}
          onUserUpdated={handleUserUpdated}
          onClose={() => setEditingUser(null)}
        />
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-100">
            <p className="text-lg font-semibold mb-9">Are you sure you want to delete this user?</p>
            <div className="flex justify-between">
              <button className="bg-gray-500 text-white px-4 py-2 rounded-md" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button className="bg-red-500 text-white px-4 py-2 rounded-md" onClick={handleDeleteUser}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserList;
