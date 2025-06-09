import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { FaTrashAlt, FaEye } from "react-icons/fa";
import { canCreate, canDelete, canView } from "../utils/accessControl";

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
              <th className="border p-2">Purchased Price</th>
              <th className="border p-2">Shell Price</th>
              <th className="border p-2">Bottle Price</th>
              <th className="border p-2">Unit Cost</th>
              <th className="border p-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {receipt.details && receipt.details.map((item, index) => (
              <tr key={index} className="text-center">
                <td className="border p-2">{item.product_name || item.item_name}</td>
                <td className="border p-2">{item.shell_qty}</td>
                <td className="border p-2">{item.pcs_qty}</td>
                <td className="border p-2">{item.bad_order_pcs}</td>
                <td className="border p-2">₱{parseFloat(item.unit_price).toFixed(2)}</td>
                <td className="border p-2">₱{parseFloat(item.shell_price).toFixed(2)}</td>
                <td className="border p-2">₱{parseFloat(item.bottle_price).toFixed(2)}</td>
                <td className="border p-2">₱{parseFloat(item.unit_cost).toFixed(2)}</td>
                <td className="border p-2 font-bold">₱{parseFloat(item.total).toFixed(2)}</td>
              </tr>
            ))}
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
            <p className="font-semibold text-right">Net Amount: ₱{parseFloat(receipt.net_amount || 0).toFixed(2)}</p>
          </div>
        </div>

        <div className="text-right mt-4">
          <button onClick={onClose} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
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
    if (!window.confirm("Are you sure you want to delete this receiving?")) return;
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

      setSelectedReceipt(receiptData);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error fetching receipt details:", error);
      alert("Error loading receipt details. Please try again.");
    }
  };

  return (
    <div className="p-8 min-h-screen bg-white">
      <div className="flex justify-end items-center mb-8">
        <Link
          to="/receiving/new"
          className={`px-6 py-2 rounded-md font-semibold ${
            canCreate("Receiving")
              ? "bg-[#0B1320] hover:bg-[#a7a7a7] text-white"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
          onClick={(e) => {
            if (!canCreate("Receiving")) e.preventDefault();
          }}
        >
          + New Receiving
        </Link>
      </div>

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
            {canView("Receiving") ? (
              receivings.map((item) => (
                <tr key={item.id} className="hover:bg-[#f8f9fa]">
                  <td className="p-3">{item.receive_no}</td>
                  <td className="p-3">{new Date(item.date_time).toLocaleString()}</td>
                  <td className="p-3">{item.supplier_name}</td>
                  <td className="p-3">{item.invoice_no}</td>
                  <td className="p-3">₱{parseFloat(item.net_amount).toFixed(2)}</td>
                  <td className="p-3 flex justify-center space-x-4">
                    <button
                      onClick={() => canView("Receiving") && handleViewReceipt(item.id)}
                      disabled={!canView("Receiving")}
                      title="View Receipt"
                      className={`text-lg ${
                        canView("Receiving")
                          ? "text-[#0047ad] hover:text-blue-700"
                          : "text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <FaEye />
                    </button>
                    <button
                      onClick={() => canDelete("Receiving") && handleDelete(item.id)}
                      disabled={!canDelete("Receiving")}
                      title="Delete"
                      className={`text-lg ${
                        canDelete("Receiving")
                          ? "text-[#a50000] hover:text-red-700"
                          : "text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <FaTrashAlt />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center py-8 text-gray-400">
                  You don’t have permission to view receiving records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ReceiptModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} receipt={selectedReceipt} />
    </div>
  );
};

export default ReceivingList;
