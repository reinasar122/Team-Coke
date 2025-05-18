import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";

const Merchandising = () => {
  const [transactionType, setTransactionType] = useState("");
  const [mspNo, setMspNo] = useState("");  // State to hold MSP number
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
  
  const [customer, setCustomer] = useState("");
  const [isAddingRoute, setIsAddingRoute] = useState(false);

  const [customers, setCustomers] = useState([]);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);

  
  //Number 1 changes
  //track available stock for each product
  const [availableStock, setAvailableStock] = useState({});

  const location = useLocation();


  useEffect(() => {
    if (location.state) {
      const {
        mspNo,
        transactionType,
        selectedUser,
        selectedRoute,
        dateTime,
        products,
      } = location.state;
  
      if (mspNo) setMspNo(mspNo);
      if (transactionType) setTransactionType(transactionType);
      if (selectedUser) setSelectedUser(selectedUser);
      if (selectedRoute) setRoute(selectedRoute);
      if (dateTime) setDateTime(dateTime);
      if (products && products.length > 0) {
        setRows(
          products.map((product) => ({
            id: Date.now() + Math.random(),
            productId: product.productId,
            quantity: product.dispatchedPcs,
            shellQty: product.dispatchedShell,
            contentNo: product.contentNo || 0,
          }))
        );
      }
    }
  }, [location.state]);


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

    axios.get("http://localhost:8080/api/customers/")
      .then(res => setCustomers(res.data))
      .catch(err => console.error("Failed to fetch customers:", err));

  }, []);



  useEffect(() => {
    console.log(transactionType);  // Log the transaction type
    if (transactionType) {
      fetchMspNo(transactionType);
    }
  }, [transactionType]);
  


  useEffect(() => {
    if (transactionType === "Van Load") {
      axios.get("http://localhost:8080/api/vans/")
        .then(res => setVans(res.data))
        .catch(err => console.error("Failed to fetch vans:", err));
    }
  }, [transactionType]);
  


  // Number 2 changes
  // Trigger fetching MSP number when the transaction type is selected
  useEffect(() => {
    if (transactionType) {
      fetchMspNo(transactionType);  // Fetch MSP No when the transaction type is selected
    }
  }, [transactionType]);  // Only run when transactionType changes

  // Fetch the next MSP number from the backend based on the transaction type
  const fetchMspNo = async (transactionType) => {
    
    try {
      // Send transaction_type as a query param to the backend API
      const response = await axios.get("http://localhost:8080/api/merchandisings/msp-next/", {
        params: { transaction_type: transactionType } // Ensure correct value is passed here
      });
      setMspNo(response.data.msp_no);  // Set the fetched MSP number
    } catch (err) {
      console.error("Error fetching MSP:", err); // Ensure errors are logged for better debugging
    }
};



 /*  // Handle route typing (saving new route if needed)
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
  };*/


  //Number 3 changes
  // Fetch the stock quantity for a specific product
const fetchStockQuantity = async (productId) => {
  try {
    const response = await axios.get(`http://localhost:8080/api/stocks/${productId}/`);
    // Store the stock quantity in availableStock state
    setAvailableStock((prevState) => ({
      ...prevState,
      [productId]: response.data.quantity_available,
    }));
  } catch (err) {
    console.error("Error fetching stock:", err);
  }
};



  //Number 4 changes
  const handleProductChange = (index, productId) => {
    const updated = [...rows];
    updated[index].productId = productId;
  
    // Fetch selected product from products list to get the content_no
  const selectedProduct = products.find(p => p.id === productId);
    if (selectedProduct) {
      updated[index].contentNo = selectedProduct.unit_type.content_no;  // Fix content_no
      console.log(`Selected Product: ${selectedProduct.product_name}, Content No: ${updated[index].contentNo}`);
    }

  
    setRows(updated);
  
    if (productId) {
      fetchStockQuantity(productId);
    }
  
    // Add a new empty row if it's the last row
    if (index === rows.length - 1) {
      setRows(prev => [...prev, { id: Date.now(), productId: "", quantity: "", shellQty: "" }]);
    }
  };
  

  //Number 5 changes
  const updateStock = async (productId, quantitySold) => {
    const newQuantity = availableStock[productId] - quantitySold;
  
    if (newQuantity < 0 || isNaN(newQuantity)) {
      console.error(`Invalid stock update for product ${productId}:`, newQuantity);
      return;
    }
  
    try {
      await axios.patch(`http://localhost:8080/api/stocks/${productId}/`, {
        quantity_available: newQuantity,
      });
    } catch (err) {
      console.error("Error updating stock:", err);
    }
  };




// Handle shell quantity input → auto calculate PCS
const handleShellQtyChange = (index, shellQtyValue) => {
  const updated = [...rows];
  updated[index].shellQty = shellQtyValue;

  const productId = updated[index].productId;
  const product = products.find(p => p.id.toString() === productId.toString());

  const contentNo = product?.unit_type?.content_no || 0;
  if (!contentNo) {
    console.warn("Missing content_no for product:", product);
  }

  const pcsQty = parseInt(shellQtyValue || 0) * contentNo;
  const stockAvailable = availableStock[productId] || 0;

  if (pcsQty > stockAvailable) {
    alert(`Insufficient stock for ${product?.product_name}. Available: ${stockAvailable} pcs.`);
    updated[index].quantity = 0; // Reset PCS if stock is not enough
  } else {
    updated[index].quantity = pcsQty;
  }

  setRows(updated);
};






// Handle "Quantity (Pcs)" change
const handleQuantityChange = (index, value) => {
  const updated = [...rows];
  updated[index].quantity = value;  // Update the quantity (PCS) state

  // Ensure contentNo is fetched correctly
  const contentNo = updated[index].contentNo || 0;
  updated[index].shellQty = Math.floor(value / contentNo);  // Update shell quantity (rounded down)

  console.log(`Updated Shell Qty: ${updated[index].shellQty}, Updated PCS: ${value}`);  // Log to check if it's calculating correctly

  setRows(updated);  // Update the state
};




const handleSave = async () => {
  if (!transactionType) {
    alert("Please select a Transaction Type before proceeding.");
    return;
  }

  const validRows = rows.filter((row) => row.productId && row.quantity && row.shellQty);

  const deductedStock = [];

  for (let row of validRows) {
    const stockQuantity = availableStock[row.productId];
    if (row.quantity > stockQuantity) {
      alert(`Not enough stock for ${row.productId}. Available: ${stockQuantity}, Requested: ${row.quantity}`);
      return;
    }

    await updateStock(row.productId, row.quantity);
    deductedStock.push({ productId: row.productId, deducted: row.quantity });
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
        mspNo, 
        selectedUser: selectedUserName,
        selectedRoute: route,
        dateTime,
        customer,
        products: selectedProductsRows,
        deductedStock,  // ✅ pass it along
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-700 text-white p-6">
      <div className="flex flex-col md:flex-row justify-between gap-6 mb-6">
        <div className="flex flex-col space-y-4 w-full md:w-1/2">
          <div>
            <label className="block mb-1">MSP NO.</label>
            <input className="w-64 p-2 rounded bg-gray-200 text-black" value={mspNo} disabled />
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


          {(transactionType === "Warehouse") && (
            <div>
              <label className="block mb-1">Customer</label>
              {isAddingCustomer ? (
                <input
                  type="text"
                  className="w-64 p-2 rounded bg-gray-200 text-black"
                  placeholder="Enter new customer"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      const newCustomer = customer.trim();
                      if (!newCustomer) return;

                      const exists = customers.some(
                        (c) => c.name.toLowerCase() === newCustomer.toLowerCase()
                      );

                      if (exists) {
                        alert(`Customer "${newCustomer}" already exists.`);
                        setIsAddingCustomer(false);
                        return;
                      }

                      try {
                        const res = await axios.post("http://localhost:8080/api/customers/", {
                          name: newCustomer,
                        });
                        setCustomers((prev) => [...prev, res.data]);
                        setCustomer(res.data.name);
                      } catch (error) {
                        console.error("Error saving new customer:", error);
                      }
                      setIsAddingCustomer(false);
                    }
                  }}
                />
              ) : (
                <select
                  value={customer}
                  onChange={(e) => {
                    if (e.target.value === "add_new") {
                      setIsAddingCustomer(true);
                      setCustomer("");
                    } else {
                      setCustomer(e.target.value);
                    }
                  }}
                  className="w-64 p-2 rounded bg-gray-200 text-black"
                >
                  <option value="" disabled hidden>Select a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  <option value="add_new">+ Add a customer</option>
                </select>
              )}
            </div>
          )}


{transactionType === "Van Load" && (
            <>
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

              <div>
                <label className="block mb-1">Route</label>
                {isAddingRoute ? (
                  <input
                    type="text"
                    className="w-64 p-2 rounded bg-gray-200 text-black"
                    placeholder="Enter new route"
                    value={route}
                    onChange={(e) => setRoute(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        const newRoute = route.trim();
                        if (!newRoute) return;

                        const exists = routes.some(
                          (r) => r.route_name.toLowerCase() === newRoute.toLowerCase()
                        );

                        if (exists) {
                          alert(`Route "${newRoute}" already exists.`);
                          setIsAddingRoute(false);
                          return;
                        }
                        
                        try {
                          const res = await axios.post("http://localhost:8080/api/routes/", {
                            route_name: newRoute,
                          });
                          setRoutes((prev) => [...prev, res.data]);
                          setRoute(res.data.route_name);
                        } catch (error) {
                          console.error("Error saving new route:", error);
                        }
                        setIsAddingRoute(false);                        
                      }
                    }}
                  />
                ) : (
                  <select
                    value={route}
                    onChange={(e) => {
                      if (e.target.value === "add_new") {
                        setIsAddingRoute(true);
                        setRoute(""); // clear any leftover value
                      } else {
                        setRoute(e.target.value);
                      }
                    }}
                    className="w-64 p-2 rounded bg-gray-200 text-black"
                  >
                    <option value="" disabled hidden>Select a route</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.route_name}>
                        {r.route_name}
                      </option>
                    ))}
                    <option value="add_new">+ Add a new route</option>
                  </select>
                )}
              </div>


            </>
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

                {/* Editable "Quantity (Pcs)" */}
                <td className="border p-2">
                  <input
                    type="number"
                    className="w-full bg-gray-200 p-1 text-center"
                    value={row.quantity}
                    onChange={(e) => handleQuantityChange(index, e.target.value)} // Handle quantity change
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
