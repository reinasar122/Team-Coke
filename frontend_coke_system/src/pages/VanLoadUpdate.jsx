import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams  } from 'react-router-dom';
import axios from 'axios'; // ✅ Make sure axios is imported

const VanLoadUpdate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const saleId = location.state?.id;
  const { id } = useParams();

  const [sale, setSale] = useState(null); // ✅ Define state to store the fetched sale

  useEffect(() => {
    if (!saleId) {
      alert("No sale ID provided.");
      navigate("/trading");
      return;
    }

    // ✅ Fetch full sale data using saleId
    axios.get(`http://localhost:8080/api/merchandising-set/${saleId}/`)
      .then((res) => {
        if (res.data.transaction_type_name !== "Van Load") {
          alert("Transaction is not Van Load.");
          navigate("/trading");
        } else {
          setSale(res.data);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch sale data", err);
        alert("Error loading sale data.");
        navigate("/trading");
      });
  }, [saleId, navigate]);

  if (!sale) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Update Van Load - MSP No: {sale.msp_no}</h2>

      <p><strong>Customer:</strong> {sale.customer_name}</p>
      <p><strong>Expected Sale:</strong> ₱{parseFloat(sale.expected_sale || 0).toLocaleString()}</p>
      <p><strong>Status:</strong> {sale.status}</p>


      <div className="mt-6 flex gap-4">
        <button
          className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600"
          onClick={() => navigate(-1)}
        >
          Cancel
        </button>

        <button
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
          onClick={() => {
            // Future save logic
            alert("Save changes here");
          }}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default VanLoadUpdate;
