import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "../App.css";

const MerchandisingSale = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};
  const editMode = state.editMode || false;
  const saleData = state.data || {};

  const [activeTab, setActiveTab] = useState("Trading");
  const [newDesc, setNewDesc] = useState("");
  const [newAmt, setNewAmt] = useState("");
  

  const [customer, setCustomer] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [expenses, setExpenses] = useState([]);
  const [rows, setRows] = useState([
    {
      id: Date.now(),
      productId: "",
      productName: "",
      priceId: "",
      dispatchedShell: "",
      dispatchedPcs: "",
      soldShell: "",
      soldPcs: "",
      expectedReturnShellEmpty: "",
      expectedReturnPcsEmpty: "",
      expectedReturnShellNonempty: "",
      expectedReturnPcsNonempty: "",
      discrepancyShellEmpty: "",
      discrepancyPcsEmpty: "",
      discrepancyShellNonempty: "",
      discrepancyPcsNonempty: "",
      discount: "",
      expectedSale: "",
      actualSale: "",
      contentNo: "",
    },
  ]);





  const [transactionType, setTransactionType] = useState("");
  const [transactionTypes, setTransactionTypes] = useState([]);
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
  const [availableStock, setAvailableStock] = useState({});
  const [mspNo, setMspNo] = useState("");


  const [dateTime, setDateTime] = useState(() => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
  });


  const [emptiesPriceTotal, setEmptiesPriceTotal] = useState(0);
  const [refundablesTotal, setRefundablesTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);


  const [status, setStatus] = useState("Pending"); // default for Van Load


  const [invoiceNo, setInvoiceNo] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [payments, setPayments] = useState([]);

  const [selectedTransactionTypeName, setSelectedTransactionTypeName] = useState("");




  const [remarks, setRemarks] = useState("");
  const [miscCharges, setMiscCharges] = useState("");
  const [expectedTotal, setExpectedTotal] = useState(0);
  const [actualTotal, setActualTotal] = useState(0);
  const [discrepancy, setDiscrepancy] = useState(0);
  // const [change, setChange] = useState("");
  const [showMiscDetails, setShowMiscDetails] = useState(false);
  const [miscDescription, setMiscDescription] = useState("");
  const [miscFiles, setMiscFiles] = useState([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState([]);
  const [zoomed, setZoomed] = useState(null);
  const [miscItems, setMiscItems] = useState([]);
  const [miscAmounts, setMiscAmounts] = useState({});
  const [pricingMap, setPricingMap] = useState({});
  // const [cashMismatch, setCashMismatch] = useState(false);
  // const [userCashInput, setUserCashInput] = useState("");
  // const [cashReceived, setCashReceived] = useState("");


 




  useEffect(() => {
  axios.get("http://localhost:8080/api/users/").then(res => setUsers(res.data));
  axios.get("http://localhost:8080/api/products/").then(res => setProducts(res.data));
  axios.get("http://localhost:8080/api/routes/").then(res => setRoutes(res.data));
  axios.get("http://localhost:8080/api/customers/").then(res => setCustomers(res.data));
}, []);


  useEffect(() => {
  if (selectedTransactionTypeName === "Van Load") {
    axios.get("http://localhost:8080/api/vans/")
      .then(res => setVans(res.data))
      .catch(err => console.error("Failed to fetch vans:", err));
  }
}, [transactionType]);




  useEffect(() => {
  if (transactionType && selectedTransactionTypeName) {
    axios.get("http://localhost:8080/api/merchandisings/msp-next/", {
      params: { transaction_type: transactionType }
    }).then(res => {
      console.log("✅ MSP Prefix check:", selectedTransactionTypeName, res.data.msp_no);
      setMspNo(res.data.msp_no);
    });
  }
}, [transactionType, selectedTransactionTypeName]);





useEffect(() => {
  axios.get("http://localhost:8080/api/transaction-types/")
    .then(res => {
      console.log("Transaction Types:", res.data); // 👈 add this
      setTransactionTypes(res.data);
    })
    .catch(err => console.error("Failed to fetch transaction types:", err));
}, []);

useEffect(() => {
  if (editMode && saleData) {
    setCustomer(saleData.customer || "");
    setRoute(saleData.route || "");
    setTransactionDate(saleData.date_time || "");
    setTransactionType(saleData.transaction_type || ""); // 🛑 This must match the backend key!
    setSelectedTransactionTypeName(saleData.transaction_type_name || "");
    setRows(saleData.products || []);
    setMiscItems(saleData.expenses || []);
    setNewDesc(saleData.remarks || "");
    setMspNo(saleData.msp_no || "");
    setSelectedUser(saleData.handled_by_id || ""); // ✅ If this exists
  }
}, [editMode, saleData]);







//   useEffect(() => {
//   const userCash = parseFloat(userCashInput) || 0;
//   const misc = parseFloat(miscCharges) || 0;
//   const totalCash = userCash + misc;
//   const total = parseFloat(actualTotal) || 0;


//   // setCashReceived(totalCash.toFixed(2));
//   // setChange(!isNaN(totalCash - total) ? (totalCash - total).toFixed(2) : "");
//   // setCashMismatch(totalCash.toFixed(2) !== total.toFixed(2));
// }, [userCashInput, miscCharges, actualTotal]);


  useEffect(() => {
    axios.get("http://localhost:8080/api/pricing/")
      .then(res => {
        const map = {};
        res.data.forEach(price => {
          map[price.id] = {
            selling_price: price.selling_price,
            shell_price: price.shell_price,
            bottle_price: price.bottle_price,
            content_no: price.content_no || 0
          };
        });
        setPricingMap(map);


        if (state.products) {
          const initialRows = state.products.map((product) => {
            const priceId = product.price?.id || product.priceId || product.price_id || null;
            const soldShell = transactionType === "Warehouse" ? product.dispatchedShell : 0;
            const soldPcs = transactionType === "Warehouse" ? product.dispatchedPcs : 0;
            return {
              id: Date.now() + Math.random(),
              productId: product.productId,
              productName: product.productName,
              priceId: priceId,
              contentNo: product.contentNo || 0,
              dispatchedShell: product.dispatchedShell || 0,
              dispatchedPcs: product.dispatchedPcs || 0,
              soldShell: soldShell,
              soldPcs: soldPcs,
              expectedReturnShellEmpty: soldShell,
              expectedReturnPcsEmpty: soldShell * (product.contentNo || 0),
              expectedReturnShellNonempty: 0,
              expectedReturnPcsNonempty: 0,
              discrepancyShellEmpty: 0,
              discrepancyPcsEmpty: 0,
              discrepancyShellNonempty: 0,
              discrepancyPcsNonempty: 0,
              discount: 0,
              expectedSale: 0,
              actualSale: 0,
              manuallyEditedNonemptyReturn: false,
            };
          });


          const recalculated = initialRows.map((row) => {
            const pricing = map[row.priceId];
            if (!pricing) return row;
            const sellingPrice = parseFloat(pricing.selling_price) || 0;
            const shellPrice = parseFloat(pricing.shell_price) || 0;
            const discount = parseFloat(row.discount) || 0;


            const expectedSale = (row.dispatchedPcs * sellingPrice) + (row.dispatchedShell * shellPrice);
            row.expectedSale = parseFloat((expectedSale * (1 - discount / 100)).toFixed(2));
            return row;
          });


          setRows(recalculated);
        }
      })
      .catch(err => {
        console.error("Failed to fetch pricing:", err);
      });
  }, [state.products, transactionType]);






  const fetchStockQuantity = async (productId) => {
  try {
    const response = await axios.get(`http://localhost:8080/api/stocks/${productId}/`);
    setAvailableStock((prev) => ({
      ...prev,
      [productId]: response.data.quantity_available,
    }));
  } catch (err) {
    console.error("Error fetching stock:", err);
  }
};




const handleProductChange = (index, productId) => {
  const updatedRows = [...rows];
  updatedRows[index].productId = productId;


  const selectedProduct = products.find((p) => p.id === parseInt(productId));
  if (selectedProduct) {
    updatedRows[index].productName = selectedProduct.product_name;
    updatedRows[index].priceId = selectedProduct.price.id;
    updatedRows[index].contentNo = selectedProduct.unit_type.content_no;


    // ✅ Fetch stock for selected product
    fetchStockQuantity(productId);
   
  }


  setRows(updatedRows);




  // ✅ Automatically add a new row if current is last and selected
  if (index === rows.length - 1 && productId) {
    setRows((prev) => [
      ...prev,
      {
        id: Date.now(),
        productId: "",
        productName: "",
        priceId: "",
        dispatchedShell: "",
        dispatchedPcs: "",
        soldShell: "",
        soldPcs: "",
        expectedReturnShellEmpty: "",
        expectedReturnPcsEmpty: "",
        expectedReturnShellNonempty: "",
        expectedReturnPcsNonempty: "",
        discrepancyShellEmpty: "",
        discrepancyPcsEmpty: "",
        discrepancyShellNonempty: "",
        discrepancyPcsNonempty: "",
        discount: "",
        expectedSale: "",
        actualSale: "",
        contentNo: "",
      },
    ]);
  }
};









const handleRowChange = (index, field, value) => {
  const updated = [...rows];
  updated[index][field] = value === "" ? "" : parseFloat(value);

  const contentNo = parseFloat(updated[index].contentNo) || 0;
  const priceId = updated[index].priceId;
  const pricing = pricingMap[priceId];
  const sellingPrice = pricing ? parseFloat(pricing.selling_price) || 0 : 0;
  const shellPrice = pricing ? parseFloat(pricing.shell_price) || 0 : 0;
  const bottlePrice = pricing ? parseFloat(pricing.bottle_price) || 0 : 0;
  const discount = parseFloat(updated[index].discount) || 0;

  let dispatchedShell = parseFloat(updated[index].dispatchedShell) || 0;
  let dispatchedPcs = parseFloat(updated[index].dispatchedPcs) || 0;

  // 🔁 SMART DISPATCHED LOGIC
  if (field === "dispatchedShell") {
    dispatchedShell = parseFloat(value) || 0;
    dispatchedPcs = dispatchedShell * contentNo;
    updated[index].dispatchedPcs = dispatchedPcs;

    const productId = updated[index].productId;
    const stockAvailable = availableStock[productId] || 0;
    if (dispatchedPcs > stockAvailable) {
      alert(`Insufficient stock for ${updated[index].productName}. Available: ${stockAvailable} PCS`);
      updated[index].dispatchedShell = "";
      updated[index].dispatchedPcs = "";
      setRows(updated);
      return;
    }
  }

  if (field === "dispatchedPcs") {
    dispatchedPcs = parseFloat(value) || 0;
    dispatchedShell = contentNo ? parseFloat((dispatchedPcs / contentNo).toFixed(2)) : 0;
    updated[index].dispatchedShell = dispatchedShell;

    const productId = updated[index].productId;
    const stockAvailable = availableStock[productId] || 0;
    if (dispatchedPcs > stockAvailable) {
      alert(`Insufficient stock for ${updated[index].productName}. Available: ${stockAvailable} PCS`);
      updated[index].dispatchedShell = "";
      updated[index].dispatchedPcs = "";
      setRows(updated);
      return;
    }
  }

  // ✅ Calculate Expected Sale
  if (pricing) {
    const rawExpected = dispatchedPcs * sellingPrice;
    const discounted = rawExpected * (1 - discount / 100);
    updated[index].expectedSale = parseFloat(discounted.toFixed(2));
  } else {
    console.warn(`No pricing found for priceId: ${priceId}`);
    updated[index].expectedSale = 0;
  }

let soldShell = parseFloat(updated[index].soldShell) || 0;
let soldPcs = parseFloat(updated[index].soldPcs) || 0;
let emptyPrice = parseFloat(updated[index].emptyPrice);
if (isNaN(emptyPrice)) {
  emptyPrice = shellPrice + bottlePrice;
}


if (field === "soldShell") {
  soldPcs = soldShell * contentNo;
  updated[index].soldPcs = soldPcs;

  if (emptyPrice > 0) {
    updated[index].expectedReturnShellEmpty = soldShell;
    updated[index].expectedReturnPcsEmpty = soldShell * contentNo;
  } else {
    updated[index].expectedReturnShellEmpty = 0;
    updated[index].expectedReturnPcsEmpty = 0;
  }
}

if (field === "soldPcs") {
  soldShell = Math.floor(soldPcs / contentNo);
  updated[index].soldShell = soldShell;

  if (emptyPrice > 0) {
    updated[index].expectedReturnShellEmpty = soldShell;
    updated[index].expectedReturnPcsEmpty = soldPcs;
  } else {
    updated[index].expectedReturnShellEmpty = 0;
    updated[index].expectedReturnPcsEmpty = 0;
  }
}



  // ✅ Only auto-compute return if not manually edited
  if (
    !updated[index].manuallyEditedNonemptyReturn &&
    (soldShell > 0 || soldPcs > 0)
  ) {
    updated[index].expectedReturnShellNonempty = dispatchedShell - soldShell;
    updated[index].expectedReturnPcsNonempty = dispatchedPcs - soldPcs;
  }

  if (
    field === "expectedReturnShellNonempty" ||
    field === "expectedReturnPcsNonempty"
  ) {
    updated[index].manuallyEditedNonemptyReturn = true;
  }

  if (field === "expectedReturnShellNonempty") {
    const shellVal = parseFloat(value) || 0;
    updated[index].expectedReturnPcsNonempty = shellVal * contentNo;
  }

  if (field === "expectedReturnShellEmpty") {
    const expectedShell = parseFloat(value) || 0;
    updated[index].expectedReturnPcsEmpty = expectedShell * contentNo;
  }

 const returnShellEmpty = parseFloat(updated[index].expectedReturnShellEmpty) || 0;
const returnPcsEmpty = parseFloat(updated[index].expectedReturnPcsEmpty) || 0;

if (emptyPrice > 0) {
  updated[index].discrepancyShellEmpty = soldShell - returnShellEmpty;
  updated[index].discrepancyPcsEmpty = soldPcs - returnPcsEmpty;
} else {
  updated[index].discrepancyShellEmpty = 0;
  updated[index].discrepancyPcsEmpty = 0;
}


  const returnShellNonempty = parseFloat(updated[index].expectedReturnShellNonempty) || 0;
  const returnPcsNonempty = parseFloat(updated[index].expectedReturnPcsNonempty) || 0;
  updated[index].discrepancyShellNonempty = dispatchedShell - soldShell - returnShellNonempty;
  updated[index].discrepancyPcsNonempty = dispatchedPcs - soldPcs - returnPcsNonempty;

  const actualSaleRaw = soldPcs * sellingPrice;
  const discountAmount = actualSaleRaw * (discount / 100);
  const finalActualSale = actualSaleRaw - discountAmount;
  updated[index].actualSale = parseFloat(finalActualSale.toFixed(2));

  // ✅ Update table rows
  setRows(updated);

  // ✅ Compute totals
  const totalExpected = updated.reduce((sum, r) => sum + parseFloat(r.expectedSale || 0), 0);
  const totalActual = updated.reduce((sum, r) => sum + parseFloat(r.actualSale || 0), 0);
  setExpectedTotal(totalExpected);
  setActualTotal(totalActual);

  const misc = parseFloat(miscCharges) || 0;

  const totalEmpties = updated.reduce((sum, r) => {
    const price = pricingMap[r.priceId] || {};
    const sp = parseFloat(price.shell_price) || 0;
    const bp = parseFloat(price.bottle_price) || 0;
    return sum + (r.soldShell * sp) + (r.soldPcs * bp);
  }, 0);

  const totalRefundables = updated.reduce((sum, r) => {
    const price = pricingMap[r.priceId] || {};
    const sp = parseFloat(price.shell_price) || 0;
    const bp = parseFloat(price.bottle_price) || 0;
    return sum + (r.expectedReturnShellEmpty * sp) + (r.expectedReturnPcsEmpty * bp);
  }, 0);

  setEmptiesPriceTotal(totalEmpties);
  setRefundablesTotal(totalRefundables);

  const totalDiscrepancyEmpty = updated.reduce((sum, r) => {
    const price = pricingMap[r.priceId] || {};
    const sp = parseFloat(price.shell_price) || 0;
    const bp = parseFloat(price.bottle_price) || 0;
    return sum + ((r.discrepancyShellEmpty || 0) * sp) + ((r.discrepancyPcsEmpty || 0) * bp);
  }, 0);

  const totalDiscrepancyNonEmpty = updated.reduce((sum, r) => {
    const price = pricingMap[r.priceId] || {};
    const sp = parseFloat(price.selling_price) || 0;
    return sum + ((r.discrepancyPcsNonempty || 0) * sp);
  }, 0);

  const overallDiscrepancy = totalDiscrepancyEmpty + totalDiscrepancyNonEmpty;
  setDiscrepancy(overallDiscrepancy.toFixed(2));

  let totalAmountValue;
  if (transactionType === "Van Load") {
    totalAmountValue = (totalActual - misc) + overallDiscrepancy;
  } else {
    totalAmountValue = (totalEmpties - totalRefundables + totalActual);
  }

  setTotalAmount(totalAmountValue);
};



  const handleSubmit = async (status = "Complete") => {
    const payload = {
      msp_no: mspNo,
      transaction_type: parseInt(transactionType),
      route: route ? parseInt(route) : null,
      van: selectedVan ? parseInt(selectedVan) : null,
      handled_by: (() => {
        const user = users.find((u) => u.id === parseInt(selectedUser));
        return user ? `${user.first_name} ${user.last_name}` : null;
      })(),

      date_time: new Date().toISOString(),
      expected_sale: parseFloat(expectedTotal) || 0,
      actual_sale: parseFloat(actualTotal) || 0,
      miscellaneous: parseFloat(miscCharges) || 0,
      payment_method: selectedPaymentMethod,
      invoice_no: invoiceNo,
      status: status,
      remarks: remarks,

      total_trading_amount: parseFloat(totalTradingAmount) || 0,
      total_expenses_amount: parseFloat(totalExpensesAmount) || 0, // ✅ Add this


      // cash_received: parseFloat(cashReceived) || 0,
      // change: parseFloat(change) || 0,

      items: rows.filter(r => r.productId).map((row) => ({
        product: parseInt(row.productId),
        dispatched_pcs: parseInt(row.dispatchedPcs) || 0,
        dispatched_shell: parseInt(row.dispatchedShell) || 0,
        sold_pcs: parseInt(row.soldPcs) || 0,
        sold_shell: parseInt(row.soldShell) || 0,
        empty_return_pcs: parseInt(row.expectedReturnPcsEmpty) || 0,
        empty_return_shell: parseInt(row.expectedReturnShellEmpty) || 0,
        actual_return_pcs: parseInt(row.expectedReturnPcsNonempty) || 0,
        actual_return_shell: parseInt(row.expectedReturnShellNonempty) || 0,
        discrepancy_empties_pc: parseInt(row.discrepancyPcsEmpty) || 0,
        discrepancy_empties_shell: parseInt(row.discrepancyShellEmpty) || 0,
        discrepancy_full_pcs: parseInt(row.discrepancyPcsNonempty) || 0,
        discrepancy_full_shell: parseInt(row.discrepancyShellNonempty) || 0,
        discount_percent: parseFloat(row.discount) || 0,
        expected_sale: parseFloat(row.expectedSale) || 0,
        actual_sale: parseFloat(row.actualSale) || 0,
      })),

      misc_items: miscItems.map((item) => ({
        description: item.description,
        amount: parseFloat(item.amount) || 0,
        receipt_file: item.file,
      })),

      payments: payments.map((p) => ({
        amount: parseFloat(p.amount) || 0,
        method: p.method,
      })),
    };



    try {
    const res = await axios.post("http://localhost:8080/api/merchandisings/", payload);
    alert("Transaction saved successfully!");
    return true; // ✅ return success
  } catch (error) {
    if (error.response) {
      console.error("Backend response error:", error.response.data);
      alert("Failed to save sale: " + JSON.stringify(error.response.data));
    } else {
      console.error(error.message);
      alert("Failed to save sale.");
    }
    return false; // ✅ return failure
  }


}
const totalExpenses = miscItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
const calculateTotalExpenses = () => {
  const miscTotal = miscItems.reduce((sum, item) => {
    const amt = parseFloat(item.amount);
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  const extra = parseFloat(newAmt);
  return miscTotal + (isNaN(extra) ? 0 : extra);
};

const totalDispatchedShell = useMemo(() => rows.reduce((sum, row) => sum + Number(row.dispatchedShell || 0), 0), [rows]);
const totalDispatchedPcs = useMemo(() => rows.reduce((sum, row) => sum + Number(row.dispatchedPcs || 0), 0), [rows]);
const totalSoldShell = useMemo(() => rows.reduce((sum, row) => sum + Number(row.soldShell || 0), 0), [rows]);
const totalSoldPcs = useMemo(() => rows.reduce((sum, row) => sum + Number(row.soldPcs || 0), 0), [rows]);

const totalExpectedReturnShellEmpty = useMemo(() => rows.reduce((sum, row) => sum + Number(row.expectedReturnShellEmpty || 0), 0), [rows]);
const totalExpectedReturnPcsEmpty = useMemo(() => rows.reduce((sum, row) => sum + Number(row.expectedReturnPcsEmpty || 0), 0), [rows]);
const totalDiscrepancyShellEmpty = useMemo(() => rows.reduce((sum, row) => sum + Number(row.discrepancyShellEmpty || 0), 0), [rows]);
const totalDiscrepancyPcsEmpty = useMemo(() => rows.reduce((sum, row) => sum + Number(row.discrepancyPcsEmpty || 0), 0), [rows]);

const totalExpectedReturnShellNonempty = useMemo(() => rows.reduce((sum, row) => sum + Number(row.expectedReturnShellNonempty || 0), 0), [rows]);
const totalExpectedReturnPcsNonempty = useMemo(() => rows.reduce((sum, row) => sum + Number(row.expectedReturnPcsNonempty || 0), 0), [rows]);
const totalDiscrepancyShellNonempty = useMemo(() => rows.reduce((sum, row) => sum + Number(row.discrepancyShellNonempty || 0), 0), [rows]);
const totalDiscrepancyPcsNonempty = useMemo(() => rows.reduce((sum, row) => sum + Number(row.discrepancyPcsNonempty || 0), 0), [rows]);

const totalExpectedSale = useMemo(() => rows.reduce((sum, row) => sum + Number(row.expectedSale || 0), 0), [rows]);
const totalActualSale = useMemo(() => rows.reduce((sum, row) => sum + Number(row.actualSale || 0), 0), [rows]);

const totalExpensesAmount = useMemo(() => calculateTotalExpenses(), [miscItems]);
const totalTradingAmount = useMemo(() => {
  return rows.reduce((sum, row) => sum + parseFloat(row.actualSale || 0), 0);
}, [rows]);

  return (
    <div className="bg-sky-300 min-h-screen p-3 text-black">
       <div className="p-6">
          <h1 className="text-xl font-bold mb-4">
            {editMode ? "View/Edit Merchandising Sale" : "New Merchandising Sale"}
          </h1>
          </div>
    <div className="expenses-tab-container flex justify-end gap-2.5">
  {/* TABS: Trading | Expenses */}
        <div className="w-full mb-4">
          <div className="flex justify-end gap-2.5 border-b border-gray-300">
            {["Trading", "Expenses"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-semibold text-sm rounded-t-md
                  ${
                    activeTab === tab
                      ? "bg-white text-blue-600 border border-b-white border-gray-300"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent"
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>

    {/* Expenses Table */}
   {activeTab === "Expenses" && (
  <div className="w-full bg-white p-4 rounded-b-md shadow mt-1">
    <h2 className="text-lg font-semibold mb-4 text-gray-700">Expenses</h2>

    <table className="w-full text-sm text-left border border-gray-300 rounded shadow">
      <thead className="bg-gray-100 text-gray-800">
        <tr>
          <th className="border border-gray-300 px-3 py-2 text-center">No.</th>
          <th className="border border-gray-300 px-3 py-2">Description</th>
          <th className="border border-gray-300 px-3 py-2 text-right">Amount (₱)</th>
        </tr>
      </thead>
      <tbody>
        {miscItems.map((item, index) => (
          <tr key={index} className="bg-white hover:bg-gray-50">
            <td className="border border-gray-300 px-3 py-2 text-center">{index + 1}</td>
            <td className="border border-gray-300 px-3 py-2">
              <input
                type="text"
                value={item.description}
                onChange={(e) => {
                  const newItems = [...miscItems];
                  newItems[index].description = e.target.value;
                  setMiscItems(newItems);
                }}
                className="w-full px-2 py-1 rounded border border-gray-300"
              />
            </td>
            <td className="border border-gray-300 px-3 py-2 text-right">
              <input
                type="number"
                value={item.amount}
                onChange={(e) => {
                  const newItems = [...miscItems];
                  newItems[index].amount = e.target.value;
                  setMiscItems(newItems);
                }}
                className="w-full text-right px-2 py-1 rounded border border-gray-300"
              />
            </td>
          </tr>
        ))}
        {/* Add New Row */}
        <tr className="bg-gray-50">
          <td className="border border-gray-300 px-3 py-2 text-center">+</td>
          <td className="border border-gray-300 px-3 py-2">
            <input
              type="text"
              placeholder="New description"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full px-2 py-1 rounded border border-gray-300"
            />
          </td>
          <td className="border border-gray-300 px-3 py-2 text-right">
            <input
              type="number"
              placeholder="0.00"
              value={newAmt}
              onChange={(e) => setNewAmt(e.target.value)}
              className="w-full text-right px-2 py-1 rounded border border-gray-300"
            />
          </td>
        </tr>
      </tbody>
    </table>

    {/* 🧮 Total Expenses */}
    <div className="mt-2 text-right text-sm font-medium text-gray-700">
      Total: <span className="text-lg font-bold">₱{totalExpensesAmount.toFixed(2)}</span>
    </div>


    <div className="flex justify-end mt-3">
      <button
        onClick={() => {
          if (newDesc && newAmt) {
            setMiscItems([...miscItems, { description: newDesc, amount: newAmt }]);
            setNewDesc("");
            setNewAmt("");
          }
        }}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        + Add Expense
      </button>
    </div>
    
  </div>
)}
  </div>
</div>

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
              onChange={(e) => {
                const id = parseInt(e.target.value);
                setTransactionType(id); // ✅ fixed
                const selected = transactionTypes.find((t) => t.id === id);
                setSelectedTransactionTypeName(selected?.name || "");
              }}


              className="w-64 p-2 rounded bg-gray-200 text-black"
            >
              <option value="" disabled hidden>Select</option>
              {transactionTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>



          </div>


          {(selectedTransactionTypeName === "Van Load" || selectedTransactionTypeName === "Warehouse") && (
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


         {selectedTransactionTypeName === "Warehouse" && (
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


          {selectedTransactionTypeName === "Van Load" && (
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
                          setRoute(res.data.id);
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
                      <option key={r.id} value={r.id}>
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
 






<div className="overflow-x-auto mt-6">
      <table className="w-full text-sm text-center border border-gray-300 rounded shadow-sm">
      <thead className="bg-gray-100 text-gray-800">
        <tr className="text-xs font-semibold">
          <th className="border border-gray-300 py-2 px-1">PRODUCT</th>
          <th className="border border-gray-300 py-2 px-1" colSpan={2}>DISPATCHED</th>
          <th className="border border-gray-300 py-2 px-1">SELLING PRICE</th>
          <th className="border border-gray-300 py-2 px-1" colSpan={2}>SOLD</th>
          <th className="border border-gray-300 py-2 px-1" colSpan={2}>EMPTY PRICE</th>
          <th className="border border-gray-300 py-2 px-1" colSpan={2}>RETURNED (Empty)</th>
          <th className="border border-gray-300 py-2 px-1" colSpan={2}>DISCREPANCY (Empty)</th>
          <th className="border border-gray-300 py-2 px-1" colSpan={2}>RETURNED (With Content/s)</th>
          <th className="border border-gray-300 py-2 px-1" colSpan={2}>DISCREPANCY (Non-empty)</th>
          <th className="border border-gray-300 py-2 px-1">DISCOUNT (%)</th>
          <th className="border border-gray-300 py-2 px-1">EXPECTED SALE</th>
          <th className="border border-gray-300 py-2 px-1">ACTUAL SALE</th>
        </tr>
        <tr className="bg-gray-200">
          <td className="border border-gray-300 py-1"></td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
          <td className="border border-gray-300 py-1"></td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
          <td className="border border-gray-300 py-1"></td>
          <td className="border border-gray-300 py-1"></td>
          <td className="border border-gray-300 py-1"></td>
        </tr>
      </thead>

  <tbody>
    {rows.map((row, index) => (
      <tr key={row.id} className="bg-white hover:bg-gray-50 transition duration-150">
        {/* PRODUCT SELECT */}
        <td className="border border-gray-200 py-1 px-1 w-[120px]">
          <select
            className="w-full p-1 text-sm text-center rounded bg-white border"
            value={row.productId}
            onChange={(e) => handleProductChange(index, e.target.value)}
          >
            <option value="">Select Product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.product_name}
              </option>
            ))}
          </select>
        </td>

        {/* DISPATCHED */}
        <td className="border border-gray-200 py-1 px-1">
          <input type="number" className="w-full p-1 text-sm text-center rounded bg-white" value={row.dispatchedShell || ""} onChange={(e) => handleRowChange(index, "dispatchedShell", e.target.value)} />
        </td>
        <td className="border border-gray-200 py-1 px-1">
          <input type="number" className="w-full p-1 text-sm text-center rounded bg-white" value={row.dispatchedPcs || ""} onChange={(e) => handleRowChange(index, "dispatchedPcs", e.target.value)} />
        </td>

        {/* SELLING PRICE */}
        <td className="border border-gray-200 py-1 px-1">
          <input type="number" disabled className="w-full p-1 text-sm text-center bg-gray-100" value={pricingMap[row.priceId]?.selling_price || ""} />
        </td>

        {/* SOLD */}
        <td className="border border-gray-200 py-1 px-1">
          <input type="number" className="w-full p-1 text-sm text-center rounded bg-yellow-50" value={row.soldShell || ""} onChange={(e) => handleRowChange(index, "soldShell", e.target.value)} />
        </td>
        <td className="border border-gray-200 py-1 px-1">
          <input type="number" className="w-full p-1 text-sm text-center rounded bg-yellow-50" value={row.soldPcs || ""} onChange={(e) => handleRowChange(index, "soldPcs", e.target.value)} />
        </td>

        {/* EMPTY PRICE */}
        <td className="border border-gray-200 py-1 px-1">
          <input type="number" className="w-full p-1 text-sm text-center bg-gray-100" value={pricingMap[row.priceId]?.shell_price || ""} disabled />
        </td>
        <td className="border border-gray-200 py-1 px-1">
          <input type="number" className="w-full p-1 text-sm text-center bg-gray-100" value={pricingMap[row.priceId]?.bottle_price || ""} disabled />
        </td>

        {/* Returned/Discrepancy fields */}
        {[
          "expectedReturnShellEmpty", "expectedReturnPcsEmpty",
          "discrepancyShellEmpty", "discrepancyPcsEmpty",
          "expectedReturnShellNonempty", "expectedReturnPcsNonempty",
          "discrepancyShellNonempty", "discrepancyPcsNonempty"
        ].map((field, i) => (
          <td key={i} className="border border-gray-200 py-1 px-1">
            <input
              type="number"
              value={row[field] === 0 ? "" : row[field]}
              onChange={(e) => handleRowChange(index, field, e.target.value)}
              disabled={["discrepancyShellEmpty", "discrepancyPcsEmpty", "discrepancyShellNonempty", "discrepancyPcsNonempty"].includes(field)}
              className={`w-full p-1 text-sm text-center rounded
                ${["expectedReturnShellEmpty", "expectedReturnPcsEmpty", "expectedReturnShellNonempty", "expectedReturnPcsNonempty"].includes(field) ? "bg-yellow-50" : "bg-gray-100"}
                ${field.includes("discrepancy") && parseInt(row[field]) !== 0 ? "bg-red-100 text-red-700 font-semibold" : ""}`}
            />
          </td>
        ))}

        {/* DISCOUNT */}
        <td className="border border-gray-200 py-1 px-1">
          <input
            type="number"
            className={`w-full p-1 text-sm text-center rounded bg-white border ${row.soldShell > 0 || row.soldPcs > 0 ? "bg-yellow-50" : "bg-gray-200 cursor-not-allowed"}`}
            value={row.discount === 0 ? "" : row.discount}
            onChange={(e) => handleRowChange(index, "discount", e.target.value)}
            disabled={!(row.soldShell > 0 || row.soldPcs > 0)}
          />
        </td>

        {/* Expected & Actual Sale */}
        <td className="border border-gray-200 py-1 px-1">
          <input
            className="w-full p-1 text-center bg-gray-50 text-gray-800 font-medium"
            disabled
            value={row.expectedSale ? `₱${parseFloat(row.expectedSale).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : ""}
          />
        </td>
        <td className="border border-gray-200 py-1 px-1">
          <input
            className="w-full p-1 text-center bg-gray-50 text-gray-800 font-medium"
            disabled
            value={row.actualSale ? `₱${parseFloat(row.actualSale).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : ""}
          />
        </td>
      </tr>
    ))}

    {/* ✅ TOTAL ROW */}
    <tr className="bg-gray-200 font-semibold text-[13px] text-right">
      <td className="border border-gray-300 py-2 px-1 text-center">TOTAL</td>
      <td className="border border-gray-300 py-2 px-1 text-center"></td>
      <td className="border border-gray-300 py-2 px-1 text-center"></td>
      <td className="border border-gray-300 py-2 px-1 text-center"></td>
      <td className="border border-gray-300 py-2 px-1 text-center"></td>
      <td className="border border-gray-300 py-2 px-1 text-center"></td>
      {Array(10).fill(null).map((_, i) => (
        <td key={i} className="border border-gray-300 py-2 px-1"></td>
      ))}
      <td className="border border-gray-300 py-2 px-1"></td>
      <td className="border border-gray-300 py-2 px-1 text-green-700">₱{totalExpectedSale.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
      <td className="border border-gray-300 py-2 px-1 text-blue-700">₱{totalActualSale.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
    </tr>
  </tbody>
</table>

</div>




  {/* Summary & Buttons */}
    <div className="mt-6 max-w-7xl mx-auto flex flex-col md:flex-row gap-16">
      <div className="w-full md:w-1/2">
        <label className="block mb-1">Remarks:</label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          className="w-full h-28 p-2 rounded"
        />
      </div>

    
</div>




            {/* Buttons */}
          <div className="flex justify-end gap-4 mt-6 max-w-7xl mx-auto">
            

            {/* Back button */}
            <button
              className="bg-gray-500 text-white px-6 py-2 rounded"
              onClick={() => {
                const confirmBack = window.confirm("Are you sure you want to go back? Unsaved changes will be lost.");
                if (confirmBack) navigate("/trading");
              }}
            >
              BACK
            </button>

           <button
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 mt-4"
            onClick={async () => {
              const confirmed = window.confirm("Are you sure you want to finalize this sale?");
              if (confirmed) {
                const success = await handleSubmit("Complete");
                if (success) {
                  // Only redirect if save was successful
                  navigate("/trading");
                }
              }
            }}
            >
              FINALIZE SALE
          </button>


          </div>



            {/* 🔍 Image Zoom Overlay */}
            {zoomed && (
              <div
                className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
                onClick={() => setZoomed(null)}
              >
                <img
                  src={zoomed}
                  alt="Zoomed"
                  className="max-w-[90%] max-h-[90%] rounded shadow-lg"
                />
              </div>
            )}
          </div>
        );
      };


export default MerchandisingSale;

