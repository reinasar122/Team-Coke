import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    // Get user data from localStorage or directly from the API if not available in localStorage
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {
      navigate("/login");
    } else {
      // Fetch user data from the backend API
      const fetchUserData = async () => {
        try {
          const response = await fetch("http://127.0.0.1:8080/api/users/");
          if (!response.ok) {
            throw new Error("Failed to fetch user data");
          }

          const data = await response.json();
          console.log(data); // Log the data to verify structure
          setUserData(data[0]);  // Assuming the API returns an array or object
        } catch (err) {
          setError("Failed to load user data. " + err.message);  // Show the error message
        } finally {
          setLoading(false);
        }
      };

      fetchUserData();
    }
  }, [navigate]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="profile-container">
      <h2 className="text-xl font-bold mb-4">User Profile</h2>
      <div className="profile-info">
        <p><strong>Name:</strong> {userData?.first_name} {userData?.last_name}</p>
        <p><strong>Gender:</strong> {userData?.gender}</p>
        <p><strong>Email:</strong> {userData?.email}</p>
        {/* Add any other fields you want to display */}
      </div>
    </div>
  );
};

export default Profile;
