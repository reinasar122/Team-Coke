// Updated ReceivingList.jsx - Added auto-reload functionality
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { FaTrashAlt, FaEye } from "react-icons/fa";

// ReceiptModal Component
const ReceiptModal = ({ isOpen, onClose, receipt }) => {
  if (!isOpen || !receipt) return null;

  const formatReceivedBy = () => {
    if (!receipt.received_by) return "N/A";
    if (receipt.received_by_name) return receipt.received_by_name;
    if (receipt.receiver_first_name && receipt.receiver_last_name) {
      return `${receipt.receiver_first_name} ${receipt.receiver_last_name}`;
    }
    return typeof receipt.received_by === "number" ? `User ID: ${receipt.received_by}` : receipt.received_by;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-3xl w-full overflow-y-auto max-h-[90vh]">
        <div className="mb-4 text-center">
          <h2 className="text-2xl font-bold">Receipt No.</h2>
          <h2 className="text-base text-[#0069ff] font-bold">#{receipt.receive_no}</h2>
          {receipt.warehouse_name && (
            <p className="text-sm text-gray-600 mt-1">Warehouse: {receipt.warehouse_name}</p>
          )}
        </div>
        
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div>
            <p><span className="font-semibold">Date & Time:</span> {new Date(receipt.date_time).toLocaleString()}</p>
            <p><span className="font-semibold">Supplier:</span> {receipt.supplier_name}</p>
            <p><span className="font-semibold">Invoice No:</span> {receipt.invoice_no}</p>
          </div>
          <div className="text-right">
            <p><span className="font-semibold">Received By:</span> {formatReceivedBy()}</p>
            <p><span className="font-semibold">Return Total Amount:</span> ₱{parseFloat(receipt.return_total_amount || 0).toFixed(2)}</p>
          </div>
        </div>
        
        <table className="min-w-full table-auto border mb-4 text-sm">
          <thead className="bg-[#0B1320] text-white">
            <tr>
              <th className="border p-2">Product</th>
              <th className="border p-2">Shell</th>
              <th className="border p-2">PCS</th>
              <th className="border p-2">BO/PCs</th>
              <th className="border p-2">Unit Price</th>
              <th className="border p-2">Shell Price</th>
              <th className="border p-2">Bottle Price</th>
              <th className="border p-2">Unit Cost</th>
              <th className="border p-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {receipt.details && receipt.details.map((item, index) => {
              // Make sure quantities are displayed correctly by converting to appropriate types
              const shellQty = item.shell_qty !== undefined ? Number(item.shell_qty) : 0;
              const pcsQty = item.pcs_qty !== undefined ? Number(item.pcs_qty) : 0;
              const badOrderPcs = item.bad_order_pcs !== undefined ? Number(item.bad_order_pcs) : 0;
              
              return (
                <tr key={index} className="text-center">
                  <td className="border p-2">{item.product_name || item.item_name}</td>
                  <td className="border p-2">{shellQty}</td>
                  <td className="border p-2">{pcsQty}</td>
                  <td className="border p-2">{badOrderPcs}</td>
                  <td className="border p-2">₱{parseFloat(item.unit_price || 0).toFixed(2)}</td>
                  <td className="border p-2">₱{parseFloat(item.shell_price || 0).toFixed(2)}</td>
                  <td className="border p-2">₱{parseFloat(item.bottle_price || 0).toFixed(2)}</td>
                  <td className="border p-2">₱{parseFloat(item.unit_cost || 0).toFixed(2)}</td>
                  <td className="border p-2 font-bold">₱{parseFloat(item.total || item.amount || 0).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {receipt.remarks && (
          <div className="mb-4">
            <p className="font-semibold">Remarks:</p>
            <p className="border p-2 rounded bg-gray-50">{receipt.remarks}</p>
          </div>
        )}
        
        <div className="flex justify-between items-center mt-4">
          <div></div>
          <div>
            <p className="font-semibold text-right">Net Amount: ₱{parseFloat(receipt.net_amount).toFixed(2)}</p>
          </div>
        </div>
        
        <div className="text-right mt-4">
          <button 
            onClick={onClose}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ReceivingList Component
const ReceivingList = () => {
  const [receivings, setReceivings] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [isLoadingWarehouse, setIsLoadingWarehouse] = useState(true);
  
  // NEW: State to track the selected warehouse from localStorage
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(null);

  // NEW: Monitor localStorage for warehouse changes
  useEffect(() => {
    const checkWarehouseChanges = () => {
      const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
      const newWarehouseId = selectedWarehouse?.id || null;
      
      console.log("🔍 [ReceivingList] Checking warehouse changes:", selectedWarehouseId, "->", newWarehouseId);
      
      if (newWarehouseId !== selectedWarehouseId) {
        console.log("🚨 [ReceivingList] WAREHOUSE CHANGE DETECTED:", selectedWarehouseId, "->", newWarehouseId);
        setSelectedWarehouseId(newWarehouseId);
      }
    };

    // Check immediately
    checkWarehouseChanges();
    
    // Check every 300ms for changes
    const interval = setInterval(checkWarehouseChanges, 300);
    
    return () => clearInterval(interval);
  }, [selectedWarehouseId]);

  // Get current warehouse info - triggers when selectedWarehouseId changes
  useEffect(() => {
    const setupWarehouse = async () => {
      console.log("🏗️ [ReceivingList] Setting up warehouse...");
      setIsLoadingWarehouse(true);
      
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
      
      let warehouse = null;
      
      // For admin users, use selected warehouse or fallback to user's warehouse
      if (user.role?.toLowerCase() === "admin") {
        if (selectedWarehouse && selectedWarehouse.id) {
          warehouse = selectedWarehouse;
          console.log(`🔄 [ReceivingList] Admin using selected warehouse: ${warehouse.name} (ID: ${warehouse.id})`);
        } else {
          warehouse = { name: user.warehouse, id: user.warehouse_id };
          console.log(`🔄 [ReceivingList] Admin using enrolled warehouse: ${warehouse.name} (ID: ${warehouse.id})`);
        }
      } else {
        // For non-admin users, always use their enrolled warehouse
        warehouse = { name: user.warehouse, id: user.warehouse_id };
        console.log(`🔄 [ReceivingList] User using enrolled warehouse: ${warehouse.name} (ID: ${warehouse.id})`);
      }
      
      // Only update if warehouse actually changed
      const hasChanged = !currentWarehouse || currentWarehouse?.id !== warehouse?.id;
      if (hasChanged) {
        console.log("🔄 [ReceivingList] Warehouse changed, updating data...");
        setCurrentWarehouse(warehouse);
        // Clear existing data when warehouse changes
        setReceivings([]);
        setUsers([]);
        setSelectedReceipt(null);
        setIsModalOpen(false);
      } else {
        console.log("📍 [ReceivingList] Warehouse same, no changes needed");
      }
      
      setIsLoadingWarehouse(false);
    };

    setupWarehouse();
  }, [selectedWarehouseId, currentWarehouse]);

  // Create axios instance with warehouse header
  const getAxiosConfig = useCallback(() => {
    const config = {};
    if (currentWarehouse?.id) {
      config.headers = {
        'X-Warehouse-ID': currentWarehouse.id
      };
      console.log(`📡 [ReceivingList] Making API call with warehouse header: ${currentWarehouse.id}`);
    } else {
      console.log("⚠️ [ReceivingList] No warehouse ID for API call!");
    }
    return config;
  }, [currentWarehouse?.id]);

  const fetchReceivings = useCallback(() => {
    if (!currentWarehouse?.id) {
      console.log("❌ [ReceivingList] Skipping receivings fetch - no warehouse ID");
      return;
    }
    
    console.log(`🔄 [ReceivingList] Fetching receivings for warehouse: ${currentWarehouse.name} (ID: ${currentWarehouse.id})`);
    const config = getAxiosConfig();
    axios.get("http://localhost:8080/api/receiving/", config)
      .then((res) => {
        console.log(`✅ [ReceivingList] Loaded ${res.data.length} receivings for warehouse ${currentWarehouse.id}`);
        setReceivings(res.data);
      })
      .catch((err) => console.error("❌ [ReceivingList] Error fetching receivings:", err));
  }, [currentWarehouse?.id, currentWarehouse?.name, getAxiosConfig]);

  const fetchUsers = useCallback(() => {
    if (!currentWarehouse?.id) {
      console.log("❌ [ReceivingList] Skipping users fetch - no warehouse ID");
      return;
    }
    
    console.log(`🔄 [ReceivingList] Fetching users for warehouse: ${currentWarehouse.name} (ID: ${currentWarehouse.id})`);
    const config = getAxiosConfig();
    axios.get("http://localhost:8080/api/users/", config)
      .then((res) => {
        console.log(`✅ [ReceivingList] Loaded ${res.data.length} users for warehouse ${currentWarehouse.id}`);
        setUsers(res.data);
      })
      .catch((err) => console.error("❌ [ReceivingList] Error fetching users:", err));
  }, [currentWarehouse?.id, currentWarehouse?.name, getAxiosConfig]);

  // Fetch data when warehouse changes
  useEffect(() => {
    if (currentWarehouse?.id && !isLoadingWarehouse) {
      fetchReceivings();
      fetchUsers();
    }
  }, [currentWarehouse?.id, isLoadingWarehouse, fetchReceivings, fetchUsers]);

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this receiving?");
    if (!confirmDelete) return;
    try {
      const config = getAxiosConfig();
      await axios.delete(`http://localhost:8080/api/receiving/${id}/`, config);
      console.log("✅ [ReceivingList] Receiving deleted successfully");
      fetchReceivings();
    } catch (error) {
      console.error("❌ [ReceivingList] Error deleting receiving:", error);
    }
  };

  const handleViewReceipt = async (id) => {
    try {
      const config = getAxiosConfig();
      const response = await axios.get(`http://localhost:8080/api/receiving/${id}/`, config);
      const receiptData = response.data;

      if (users.length > 0 && receiptData.received_by) {
        const user = users.find(u => u.id === Number(receiptData.received_by));
        if (user) {
          receiptData.received_by_name = `${user.first_name} ${user.last_name}`;
        }
      }

      receiptData.details = (receiptData.details || []).map(item => ({
        product_name: item.product_name,
        shell_qty: Number(item.shell_qty ?? 0),
        pcs_qty: Number(item.pcs_qty ?? 0),
        bad_order_pcs: Number(item.bad_order_pcs ?? 0),
        unit_price: Number(item.unit_price ?? 0),
        shell_price: Number(item.shell_price ?? 0),
        bottle_price: Number(item.bottle_price ?? 0),
        unit_cost: Number(item.unit_cost ?? 0),
        total: Number(item.total ?? 0),
      }));

      setSelectedReceipt(receiptData);
      setIsModalOpen(true);
    } catch (error) {
      console.error("❌ [ReceivingList] Error fetching receipt details:", error);
      alert("Error loading receipt details. Please try again.");
    }
  };

  // Show loading if no warehouse is set or still loading
  if (!currentWarehouse || isLoadingWarehouse) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading warehouse information...</p>
          <p className="text-sm text-gray-500 mt-2">Updating receiving data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen bg-white">
      {/* Enhanced Warehouse Info Header */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">📦 Current Warehouse</h3>
        <p className="text-blue-700">
          Showing receiving data for: <strong>{currentWarehouse.name}</strong> (ID: {currentWarehouse.id})
        </p>
        <p className="text-xs text-gray-500 mt-1">🔍 Monitoring ID: {selectedWarehouseId}</p>
      </div>

      <div className="flex justify-end items-center mb-8">
        <Link to="/receiving/new" className="bg-[#0B1320] hover:bg-[#a7a7a7] text-white px-6 py-2 rounded-md font-semibold">
          + New Receiving
        </Link>
       
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow-md">
        <table className="min-w-full text-sm">
          <thead className="bg-[#0B1320] text-white">
            <tr>
              <th className="p-3 text-left">Receive No</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Supplier</th>
              <th className="p-3 text-left">Invoice</th>
              <th className="p-3 text-left">Net Amount</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300">
            {receivings.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-8 text-center text-gray-500">
                  No receiving records found for {currentWarehouse.name}
                </td>
              </tr>
            ) : (
              receivings.map((item) => (
                <tr key={item.id} className="hover:bg-[#f8f9fa]">
                  <td className="p-3">{item.receive_no}</td>
                  <td className="p-3">{new Date(item.date_time).toLocaleString()}</td>
                  <td className="p-3">{item.supplier_name}</td>
                  <td className="p-3">{item.invoice_no}</td>
                  <td className="p-3">₱{parseFloat(item.net_amount).toFixed(2)}</td>
                  <td className="p-3 flex justify-center space-x-4">
                    <button onClick={() => handleViewReceipt(item.id)} className="text-[#0047ad] hover:text-blue-700 text-lg" title="View Receipt">
                      <FaEye />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="text-[#a50000] hover:text-red-700 text-lg" title="Delete">
                      <FaTrashAlt />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <ReceiptModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        receipt={selectedReceipt}
      />
    </div>
  );
};

export default ReceivingList;