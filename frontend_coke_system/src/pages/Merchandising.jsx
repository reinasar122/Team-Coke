import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";

const Merchandising = () => {
  const [mspNo, setMspNo] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [vans, setVans] = useState([]);
  const [selectedVan, setSelectedVan] = useState("");
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [route, setRoute] = useState("");
  const [routes, setRoutes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const navigate = useNavigate();
  const [dateTime, setDateTime] = useState(() => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  });
  const [rows, setRows] = useState([
    { id: Date.now(), productId: "", quantity: "", shellQty: "" }
  ]);


  //const [customer, setCustomer] = useState("");


  //Make changes for stock (track available stock for each product)
  const [availableStock, setAvailableStock] = useState({});

  const location = useLocation();


  useEffect(() => {
    const savedForm = localStorage.getItem("merchForm");

    if (location.state) {
      const {
        mspNo,
        transactionType,
        selectedUser,
        selectedRoute,
        selectedVan,
        dateTime,
        products,
      } = location.state;

      if (mspNo) setMspNo(mspNo);
      if (transactionType) setTransactionType(transactionType);
      if (selectedUser) setSelectedUser(selectedUser);
      if (selectedRoute) setRoute(selectedRoute);
      if (selectedVan) setSelectedVan(selectedVan);
      if (dateTime) setDateTime(dateTime);

      if (products && products.length > 0) {
      const restoredRows = products.map((product) => ({
        id: Date.now() + Math.random(),
        productId: product.productId,
        quantity: product.dispatchedPcs,
        shellQty: product.dispatchedShell,
        contentNo: product.contentNo || 0,
      }));

      setRows(restoredRows);

      // ✅ Fetch stock for each restored product
      products.forEach((product) => {
        fetchStockQuantity(product.productId);
      });
    }




  } else if (savedForm) {
    const data = JSON.parse(savedForm);
    setMspNo(data.mspNo);
    setTransactionType(data.transactionType);
    setSelectedUser(data.selectedUser);
    setRoute(data.selectedRoute);
    setDateTime(data.dateTime);
    setRows(
      data.products.map((product) => ({
        id: Date.now() + Math.random(),
        productId: product.productId,
        quantity: product.quantity,
        shellQty: product.shellQty,
        contentNo: product.contentNo || 0,
      }))
    );
  }
}, [location.state]);



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
      if (!selectedCustomerId) {
        alert("Please select a Customer before proceeding.");
        return;
      }
    }


  const validRows = rows.filter((row) => row.productId && row.quantity && row.shellQty);

  // Prepare deduction data but DO NOT apply it yet
  const deductedStock = validRows.map((row) => ({
    productId: row.productId,
    deducted: parseInt(row.quantity)
  }));

 
  
  for (let row of validRows) {
    const stockQuantity = availableStock[row.productId];
    if (row.quantity > stockQuantity) {
      alert(`Not enough stock for ${row.productId}. Available: ${stockQuantity}, Requested: ${row.quantity}`);
      return;
    }

  }




    const confirmed = window.confirm("Do you want to proceed with saving?");
    if (!confirmed) return;

    let selectedUserName = selectedUser;

    // If selectedUser is a number (i.e., an ID), resolve it to full name
    if (!isNaN(selectedUser)) {
      const user = users.find((u) => u.id.toString() === selectedUser.toString());
      selectedUserName = user ? `${user.first_name} ${user.last_name}` : "N/A";
    }


    const selectedProductsRows = validRows.map((row) => {
      const product = products.find((p) => p.id.toString() === row.productId.toString());
      return {
        productId: row.productId,
        productName: product ? product.product_name : "",
        dispatchedShell: row.shellQty,
        dispatchedPcs: row.quantity,
        priceId: product?.price?.id || product?.priceId || product?.price_id || null,
        contentNo: product?.unit_type?.content_no || 0
      };
    });

    // Ensure customer name is found for display
      let customerObj = customers.find(c => c.id.toString() === selectedCustomerId.toString());

    
    navigate("/merchandising-sale", {
      state: {
        mspNo,
        transactionType,
        selectedUser: selectedUserName,
        selectedRoute: route,
        dateTime,
        customerId: selectedCustomerId,
        customer: customerObj?.name || "",
        selectedVan, // ✅ <-- add this line
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
            <input
              className="w-64 p-2 rounded bg-gray-200 text-black"
              value={mspNo}
              disabled
            />
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
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      const newCustomer = e.target.value.trim();
                      if (!newCustomer) return;

                      const exists = customers.some(
                        (c) => c.name?.toLowerCase() === newCustomer.toLowerCase()
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
                        setSelectedCustomerId(res.data.id); // ⬅ use ID here
                      } catch (error) {
                        console.error("Error saving new customer:", error);
                      }
                      setIsAddingCustomer(false);
                    }
                  }}
                />
              ) : (
                <select
                  value={selectedCustomerId}
                  onChange={(e) => {
                    if (e.target.value === "add_new") {
                      setIsAddingCustomer(true);
                      setSelectedCustomerId(""); // reset if switching to input
                    } else {
                      setSelectedCustomerId(e.target.value);
                    }
                  }}
                  className="w-64 p-2 rounded bg-gray-200 text-black"
                >
                  <option value="" disabled hidden>Select a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
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
      {/* Table Section */}
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
                    className="w-full bg-white p-1 text-center"
                    value={row.shellQty}
                    onChange={(e) => handleShellQtyChange(index, e.target.value)}
                  />
                </td>

                <td className="border p-2">
                  <input
                    type="number"
                    className="w-full bg-white p-1 text-center"
                    value={row.quantity}
                    onChange={(e) => handleQuantityChange(index, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Save Button */}
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