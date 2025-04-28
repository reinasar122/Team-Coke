import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const Merchandising = () => {
  const [transactionType, setTransactionType] = useState("");
  const [vans, setVans] = useState([]);
  const [selectedVan, setSelectedVan] = useState("");
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [route, setRoute] = useState("");
  const [routes, setRoutes] = useState([]);
  const [dateTime, setDateTime] = useState(() => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  });
  const [rows, setRows] = useState([
    { id: Date.now(), productId: "", quantity: "", shellQty: "" }
  ]);

  const navigate = useNavigate();

  // Fetch initial data
  useEffect(() => {
    axios.get("http://localhost:8080/api/users/")
      .then(res => setUsers(res.data))
      .catch(err => console.error("Failed to fetch users:", err));

    axios.get("http://localhost:8080/api/products/")
      .then(res => setProducts(res.data))
      .catch(err => console.error("Failed to fetch products:", err));

    axios.get("http://localhost:8080/api/routes/")
      .then(res => setRoutes(res.data))
      .catch(err => console.error("Failed to fetch routes:", err));
  }, []);

  useEffect(() => {
    if (transactionType === "Van Load") {
      axios.get("http://localhost:8080/api/vans/")
        .then(res => setVans(res.data))
        .catch(err => console.error("Failed to fetch vans:", err));
    }
  }, [transactionType]);

  // Handle product selection
  const handleProductChange = (index, productId) => {
    const updated = [...rows];
    updated[index].productId = productId;
    setRows(updated);

    if (index === rows.length - 1) {
      setRows(prev => [
        ...prev,
        { id: Date.now(), productId: "", quantity: "", shellQty: "" }
      ]);
    }
  };

  // Handle shell quantity input → auto calculate PCS
  const handleShellQtyChange = (index, shellQtyValue) => {
    const updated = [...rows];
    updated[index].shellQty = shellQtyValue;

    const selectedProduct = products.find(
      (p) => p.id.toString() === updated[index].productId.toString()
    );

    if (selectedProduct) {
      const contentNo = selectedProduct.content_no || 0;
      updated[index].quantity = parseInt(shellQtyValue || 0) * contentNo;
    } else {
      updated[index].quantity = "";
    }

    setRows(updated);
  };

  // Handle route typing (saving new route if needed)
  const handleRouteKeyDown = async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmedRoute = route.trim();
      if (!trimmedRoute) return;

      const exists = routes.some(r =>
        r.route_name.toLowerCase() === trimmedRoute.toLowerCase()
      );

      if (!exists) {
        try {
          const res = await axios.post("http://localhost:8080/api/routes/", {
            route_name: trimmedRoute,
          });
          setRoutes(prev => [...prev, res.data]);
          console.log("Route saved:", res.data.route_name);
        } catch (error) {
          console.error("Error saving route:", error);
        }
      }
    }
  };

  const handleSave = async () => {
    // Always check if Transaction Type is selected
    if (!transactionType) {
      alert("Please select a Transaction Type before proceeding.");
      return;
    }
  
    // Then check based on transaction type
    if (transactionType === "Van Load") {
      if (!selectedVan) {
        alert("Please select a Van before proceeding.");
        return;
      }
      if (!selectedUser) {
        alert("Please select the Handled By user before proceeding.");
        return;
      }
      if (!route.trim()) {
        alert("Please enter a Route before proceeding.");
        return;
      }
    }
  
    if (transactionType === "Warehouse") {
      if (!selectedUser) {
        alert("Please select the Handled By user before proceeding.");
        return;
      }
    }
  
    const validRows = rows.filter(
      (row) => row.productId && row.quantity && row.shellQty
    );
  
    if (validRows.length === 0) {
      alert("Please complete at least one full product row before saving.");
      return;
    }
  
    const confirmed = window.confirm("Do you want to proceed with saving?");
    if (!confirmed) return;
  
    const user = users.find((u) => u.id.toString() === selectedUser.toString());
    const selectedUserName = user ? `${user.first_name} ${user.last_name}` : "N/A";
  
    const selectedProductsRows = validRows.map((row) => {
      const product = products.find((p) => p.id.toString() === row.productId.toString());
      return {
        productId: row.productId,
        productName: product ? product.product_name : "",
        dispatchedShell: row.shellQty,
        dispatchedPcs: row.quantity,
      };
    });
  
    navigate("/merchandising-sale", {
      state: {
        transactionType,
        selectedUser: selectedUserName,
        selectedRoute: route,
        dateTime,
        products: selectedProductsRows,
      }
    });
  };
  
  
  return (
    <div className="min-h-screen bg-gray-700 text-white p-6">
      <div className="flex flex-col md:flex-row justify-between gap-6 mb-6">
        <div className="flex flex-col space-y-4 w-full md:w-1/2">
          <div>
            <label className="block mb-1">MSP NO.</label>
            <input className="w-64 p-2 rounded bg-gray-200 text-black" disabled />
          </div>

          <div>
            <label className="block mb-1">Transaction Type</label>
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value)}
              className="w-64 p-2 rounded bg-gray-200 text-black"
            >
              <option value="" disabled hidden>Select</option>
              <option value="Warehouse">Warehouse</option>
              <option value="Van Load">Van Load</option>
            </select>
          </div>

          {transactionType === "Van Load" && (
            <div>
              <label className="block mb-1">Van</label>
              <select
                value={selectedVan}
                onChange={(e) => setSelectedVan(e.target.value)}
                className="w-64 p-2 rounded bg-gray-200 text-black"
              >
                <option value="" disabled hidden>Select</option>
                {vans.map((van) => (
                  <option key={van.id} value={van.id}>
                    {van.van_id} - {van.plate_number}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(transactionType === "Van Load" || transactionType === "Warehouse") && (
            <div>
              <label className="block mb-1">Handled by:</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-64 p-2 rounded bg-gray-200 text-black"
              >
                <option value="" disabled hidden>Select</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-col space-y-4 w-full md:w-1/2">
          <div>
            <label className="block mb-1">Date and Time</label>
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="w-64 p-2 rounded bg-gray-200 text-black"
            />
          </div>

          {transactionType === "Van Load" && (
            <div>
              <label className="block mb-1">Route</label>
              <input
                list="route-options"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                onKeyDown={handleRouteKeyDown}
                className="w-64 p-2 rounded bg-gray-200 text-black"
                placeholder="Type or select route"
              />
              <datalist id="route-options">
                {routes.map((r) => (
                  <option key={r.id} value={r.route_name} />
                ))}
              </datalist>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto bg-gray-100 rounded">
        <table className="table-auto w-full text-black">
          <thead>
            <tr className="bg-gray-300">
              <th className="border p-2">Product Name</th>
              <th className="border p-2">Quantity (Shell)</th>
              <th className="border p-2">Quantity (Pcs)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                <td className="border p-2">
                  <select
                    className="w-full bg-white p-1 text-black"
                    value={row.productId}
                    onChange={(e) => handleProductChange(index, e.target.value)}
                  >
                    <option value="" disabled hidden>Select</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.product_name}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="border p-2">
                  <input
                    type="number"
                    className="w-full bg-white p-1"
                    value={row.shellQty}
                    onChange={(e) => handleShellQtyChange(index, e.target.value)}
                  />
                </td>

                <td className="border p-2">
                  <input
                    type="number"
                    className="w-full bg-gray-200 p-1 text-center"
                    value={row.quantity}
                    disabled
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded"
        >
          NEXT
        </button>
      </div>
    </div>
  );
};

export default Merchandising;