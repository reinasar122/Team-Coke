import { useEffect, useState, useMemo } from "react";
import axios from "axios";

const API = "http://localhost:8080/api";

export default function ProfilePage() {
  const [u, setU] = useState({
    id: null,
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    gender: "",
    role_name: "",
    warehouse_name: "",
    avatar_url: "",
    created_at: null,
    last_login: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user profile data when component mounts
  useEffect(() => {
    const token = localStorage.getItem("token");  // Get token from localStorage

    if (!token) {
      setError("No authentication token found");
      setLoading(false);
      return;
    }

    // Fetch the user profile with the token
    axios
      .get(`${API}/users/`, {
        headers: {
          Authorization: `Bearer ${token}`,  // Include token in the request header
        },
      })
      .then((response) => {
        setU(response.data); // Update state with fetched user data
        setLoading(false);
      })
      .catch((error) => {
        setError("Error fetching user profile");
        setLoading(false);
      });
  }, []);

  // Helper: format ISO → readable date/time
  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  const createdAtText =
    u.created_at ? fmt.format(new Date(u.created_at)) : "—";
  const lastLoginText =
    u.last_login ? fmt.format(new Date(u.last_login)) : "—";

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">My Profile</h1>
      </div>

      {/* Top: avatar + editable basics */}
      <div className="grid md:grid-cols-[160px_1fr] gap-6 items-start">
        {/* Avatar */}
        <div className="space-y-3">
          {u.avatar_url && (
            <img src={u.avatar_url} alt="Avatar" className="w-32 h-32 rounded-full" />
          )}
        </div>

        {/* Profile fields */}
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Username</label>
              <input
                className="w-full border rounded p-2 bg-gray-100"
                value={u.username}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Email</label>
              <input
                className="w-full border rounded p-2"
                value={u.email || ""}
                onChange={(e) => setU({ ...u, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">First name</label>
              <input
                className="w-full border rounded p-2"
                value={u.first_name || ""}
                onChange={(e) => setU({ ...u, first_name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Last name</label>
              <input
                className="w-full border rounded p-2"
                value={u.last_name || ""}
                onChange={(e) => setU({ ...u, last_name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Phone</label>
              <input
                className="w-full border rounded p-2"
                value={u.phone_number || ""}
                onChange={(e) => setU({ ...u, phone_number: e.target.value })}
              />
            </div>

            {/* Read-only from registration */}
            <div>
              <label className="block text-sm mb-1">Gender</label>
              <input
                className="w-full border rounded p-2 bg-gray-100"
                value={u.gender || ""}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Role</label>
              <input
                className="w-full border rounded p-2 bg-gray-100"
                value={u.role_name || ""}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Warehouse</label>
              <input
                className="w-full border rounded p-2 bg-gray-100"
                value={u.warehouse_name || ""}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Created At</label>
              <input
                className="w-full border rounded p-2 bg-gray-100"
                value={createdAtText}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Last Login</label>
              <input
                className="w-full border rounded p-2 bg-gray-100"
                value={lastLoginText}
                readOnly
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
