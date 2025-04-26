import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { FaTrashAlt, FaEye } from "react-icons/fa";

const ReceiptModal = ({ isOpen, onClose, receipt }) => {
  if (!isOpen || !receipt) return null;
  
  // Format the received_by field to show a name instead of just an ID
  // This handles both cases where the API might return a name or just an ID
  const formatReceivedBy = () => {
    if (!receipt.received_by) return "N/A";
    
    // If received_by_name exists, use it directly
    if (receipt.received_by_name) return receipt.received_by_name;
    
    // If receiver_first_name and receiver_last_name exist, combine them
    if (receipt.receiver_first_name && receipt.receiver_last_name) {
      return `${receipt.receiver_first_name} ${receipt.receiver_last_name}`;
    }
    
    // If only an ID is available, show a more user-friendly message
    return typeof receipt.received_by === 'number' ? 
      `User ID: ${receipt.received_by}` : receipt.received_by;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-3xl w-full overflow-y-auto max-h-[90vh]">
        <div className="mb-4 text-center">
          <h2 className="text-xl font-bold">Receipt #{receipt.receive_no}</h2>
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
          <thead className="bg-purple-200 text-gray-800">
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

const ReceivingList = () => {
  const [receivings, setReceivings] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchReceivings();
    fetchUsers();
  }, []);

  const fetchReceivings = () => {
    axios.get("http://localhost:8080/api/receiving/")
      .then((res) => setReceivings(res.data))
      .catch((err) => console.error("Error fetching data:", err));
  };

  const fetchUsers = () => {
    axios.get("http://localhost:8080/api/users/")
      .then((res) => setUsers(res.data))
      .catch((err) => console.error("Error fetching users:", err));
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this receiving?");
    if (!confirmDelete) return;

    try {
      await axios.delete(`http://localhost:8080/api/receiving/${id}/`);
      fetchReceivings(); // Refresh the list after deletion
    } catch (error) {
      console.error("Error deleting receiving:", error);
    }
  };

  const handleViewReceipt = async (id) => {
    try {
      // Fetch the detailed receipt data
      const response = await axios.get(`http://localhost:8080/api/receiving/${id}/`);
      const receiptData = response.data;
      
      console.log("Receipt data:", JSON.stringify(receiptData, null, 2));
      
      // If we have the users data, find the user and add their name to the receipt
      if (users.length > 0 && receiptData.received_by) {
        const user = users.find(u => u.id === Number(receiptData.received_by));
        if (user) {
          receiptData.received_by_name = `${user.first_name} ${user.last_name}`;
        }
      }
      
      // Get the details array
      const detailsArray = receiptData.details || receiptData.items || [];
      
      // Process the details array with DIRECT FIX for shell/pcs values
      receiptData.details = detailsArray.map(item => {
        // Get the original values
        const originalShellQty = Number(item.shell_qty || 0);
        const originalPcsQty = Number(item.pcs_qty || 0);
        
        // Create a processed item
        const processedItem = {
          product_name: item.product_name || item.item_name || "Unknown Product",
          bad_order_pcs: Number(item.bad_order_pcs || 0),
          unit_price: Number(item.unit_price || 0),
          shell_price: Number(item.shell_price || 0),
          bottle_price: Number(item.bottle_price || 0),
          unit_cost: Number(item.unit_cost || 0),
          total: Number(item.total || item.amount || 0)
        };
        
        // CRITICAL FIX: Check if shell_qty and pcs_qty are the same
        if (originalShellQty > 0 && originalPcsQty > 0 && originalShellQty === originalPcsQty) {
          // They're the same - this is the issue we need to fix
          
          // We need to determine the content_no (pieces per shell)
          // Since we don't have product-specific data:
          // 1. Default to 24 pieces per shell (common for beverages)
          // 2. But use different values for common product types
          
          let contentNo = 24; // Default value
          
          // Get product name in lowercase for easier checking
          const productNameLower = processedItem.product_name.toLowerCase();
          
          // Adjust content_no based on product name patterns
          if (productNameLower.includes("coke") || 
              productNameLower.includes("pepsi") || 
              productNameLower.includes("cola") || 
              productNameLower.includes("sprite") || 
              productNameLower.includes("soda")) {
            // Common soda/beverage counts
            contentNo = 24;
          } else if (productNameLower.includes("beer") || 
                    productNameLower.includes("liquor") || 
                    productNameLower.includes("alcohol")) {
            // Common count for beer
            contentNo = 24;
          } else if (productNameLower.includes("water")) {
            // Common for bottled water
            contentNo = 24;
          } else if (productNameLower.includes("juice")) {
            // Common for juice bottles
            contentNo = 12;
          }
          
          // Assign the correct values - IMPORTANT:
          // Keep pcs_qty as is (it's likely correct from user input)
          // Calculate shell_qty from pcs_qty using contentNo
          processedItem.pcs_qty = originalPcsQty;
          processedItem.shell_qty = Math.ceil(originalPcsQty / contentNo);
          
          console.log(`Fixed values for ${processedItem.product_name}: ` +
            `Original shell/pcs=${originalShellQty}, ` +
            `New shell=${processedItem.shell_qty}, ` +
            `New pcs=${processedItem.pcs_qty}, ` +
            `Using content_no=${contentNo}`);
        } else {
          // No duplication detected, use original values
          processedItem.shell_qty = originalShellQty;
          processedItem.pcs_qty = originalPcsQty;
        }
        
        return processedItem;
      });
      
      setSelectedReceipt(receiptData);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error fetching receipt details:", error);
      alert("Error loading receipt details. Please try again.");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Receiving List</h2>
        <Link
          to="/receiving/new"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          + Add New Receiving
        </Link>
      </div>

      <table className="min-w-full table-auto border">
        <thead className="bg-gray-200">
          <tr>
            <th className="border p-2">Receive No</th>
            <th className="border p-2">Date</th>
            <th className="border p-2">Supplier</th>
            <th className="border p-2">Invoice</th>
            <th className="border p-2">Net Amount</th>
            <th className="border p-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {receivings.map((item) => (
            <tr key={item.id} className="text-center">
              <td className="border p-2">{item.receive_no}</td>
              <td className="border p-2">{new Date(item.date_time).toLocaleString()}</td>
              <td className="border p-2">{item.supplier_name}</td>
              <td className="border p-2">{item.invoice_no}</td>
              <td className="border p-2">₱{parseFloat(item.net_amount).toFixed(2)}</td>
              <td className="border p-2 flex justify-center space-x-3">
                <button
                  onClick={() => handleViewReceipt(item.id)}
                  className="text-blue-600 hover:text-blue-800 text-xl"
                  title="View Receipt"
                >
                  <FaEye />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-red-600 hover:text-red-800 text-xl"
                  title="Delete"
                >
                  <FaTrashAlt />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Receipt Modal */}
      <ReceiptModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        receipt={selectedReceipt} 
      />
    </div>
  );
};

export default ReceivingList;