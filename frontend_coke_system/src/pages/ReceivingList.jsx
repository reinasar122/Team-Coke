import React, { useEffect, useState } from "react";
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
      fetchReceivings();
    } catch (error) {
      console.error("Error deleting receiving:", error);
    }
  };

  const handleViewReceipt = async (id) => {
    try {
      const response = await axios.get(`http://localhost:8080/api/receiving/${id}/`);
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
      console.error("Error fetching receipt details:", error);
      alert("Error loading receipt details. Please try again.");
    }
  };

  return (
    <div className="p-8 min-h-screen bg-white">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-[#041021]"></h1>
        <Link
          to="/receiving/new"
          className="bg-[#0B1320] hover:bg-[#a7a7a7] text-white px-6 py-2 rounded-md font-semibold"
        >
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
            {receivings.map((item) => (
              <tr key={item.id} className="hover:bg-[#f8f9fa]">
                <td className="p-3">{item.receive_no}</td>
                <td className="p-3">{new Date(item.date_time).toLocaleString()}</td>
                <td className="p-3">{item.supplier_name}</td>
                <td className="p-3">{item.invoice_no}</td>
                <td className="p-3">₱{parseFloat(item.net_amount).toFixed(2)}</td>
                <td className="p-3 flex justify-center space-x-4">
                  <button
                    onClick={() => handleViewReceipt(item.id)}
                    className="text-[#0047ad] hover:text-blue-700 text-lg"
                    title="View Receipt"
                  >
                    <FaEye />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-[#a50000] hover:text-red-700 text-lg"
                    title="Delete"
                  >
                    <FaTrashAlt />
                  </button>
                </td>
              </tr>
            ))}
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