// Updated ReceivingList.jsx - uses global.scss + receivinglist.scss
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { FaTrashAlt, FaEye } from "react-icons/fa";
import "../styles/pages/receivinglist.scss"; // page-specific extras only

const ReceiptModal = ({ isOpen, onClose, receipt }) => {
  if (!isOpen || !receipt) return null;

  const formatReceivedBy = () => {
    if (!receipt.received_by) return "N/A";
    if (receipt.received_by_name) return receipt.received_by_name;
    if (receipt.receiver_first_name && receipt.receiver_last_name) {
      return `${receipt.receiver_first_name} ${receipt.receiver_last_name}`;
    }
    return typeof receipt.received_by === "number"
      ? `User ID: ${receipt.received_by}`
      : receipt.received_by;
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 960 }}>
        <div className="modal-body">
          <div className="receiving-receipt-header">
            <h2 className="page-title">Receipt No.</h2>
            <div className="receipt-no">#{receipt.receive_no}</div>
            {receipt.warehouse_name && (
              <div className="muted">Warehouse: {receipt.warehouse_name}</div>
            )}
          </div>

          <div className="receipt-meta">
            <div className="meta-col">
              <p><strong>Date &amp; Time:</strong> {new Date(receipt.date_time).toLocaleString()}</p>
              <p><strong>Supplier:</strong> {receipt.supplier_name}</p>
              <p><strong>Invoice No:</strong> {receipt.invoice_no}</p>
            </div>
            <div className="meta-col right">
              <p><strong>Received By:</strong> {formatReceivedBy()}</p>
              <p>
                <strong>Return Total Amount:</strong>{" "}
                ₱{parseFloat(receipt.return_total_amount || 0).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="card" >
            <div className="table-wrapper">
              <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Shell</th>
                  <th>PCS</th>
                  <th>BO/PCs</th>
                  <th>Purchased Price</th>
                  <th>Shell Price</th>
                  <th>Bottle Price</th>
                  <th>Unit Cost</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(receipt.details || []).map((item, index) => (
                  <tr key={index}>
                    <td>{item.product_name || item.item_name}</td>
                    <td>{item.shell_qty}</td>
                    <td>{item.pcs_qty}</td>
                    <td>{item.bad_order_pcs}</td>
                    <td>₱{parseFloat(item.unit_price).toFixed(2)}</td>
                    <td>₱{parseFloat(item.shell_price).toFixed(2)}</td>
                    <td>₱{parseFloat(item.bottle_price).toFixed(2)}</td>
                    <td>₱{parseFloat(item.unit_cost).toFixed(2)}</td>
                    <td><strong>₱{parseFloat(item.total).toFixed(2)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {receipt.remarks && (
            <div className="remarks">
              <p className="label"><strong>Remarks:</strong></p>
              <p className="remarks-box">{receipt.remarks}</p>
            </div>
          )}

          <div className="totals">
            <div className="spacer" />
            <div className="net">
              <strong>Net Amount:</strong>{" "}
              ₱{parseFloat(receipt.net_amount || 0).toFixed(2)}
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn btn-danger" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, receivingId }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-body">
          <h3 className="page-title">Confirm Delete</h3>
          <p>Are you sure you want to delete this receiving record?</p>
          <p className="text-muted">This action cannot be undone.</p>

          <div className="modal-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={onConfirm}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReceivingList = () => {
  const [receivings, setReceivings] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [isLoadingWarehouse, setIsLoadingWarehouse] = useState(true);

  // Track localStorage-driven changes
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  const [deleteModal, setDeleteModal] = useState({ open: false, id: null });

  // Detect user/warehouse switch via localStorage
  useEffect(() => {
    const checkChanges = () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
      const newWarehouseId = selectedWarehouse?.id || null;
      const newUserId = user?.id || null;

      if (newUserId !== currentUserId) {
        setCurrentUserId(newUserId);
        setSelectedWarehouseId(null);
        setReceivings([]);
        setSelectedReceipt(null);
        setIsModalOpen(false);
        return;
      }

      if (newWarehouseId !== selectedWarehouseId) {
        setSelectedWarehouseId(newWarehouseId);
      }
    };

    checkChanges();
    const interval = setInterval(checkChanges, 300);
    return () => clearInterval(interval);
  }, [selectedWarehouseId, currentUserId]);

  // Resolve current warehouse (Admin vs non-admin)
  useEffect(() => {
    const fetchWarehouseByName = async (warehouseName) => {
      try {
        const res = await axios.get("http://localhost:8080/api/warehouses/");
        return res.data.find((w) => w.name === warehouseName) || null;
      } catch (e) {
        console.error("[ReceivingList] Error fetching warehouses:", e);
        return null;
      }
    };

    const setupWarehouse = async () => {
      setIsLoadingWarehouse(true);
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
      let warehouse = null;

      if ((user.role || "").toLowerCase() === "admin") {
        if (selectedWarehouse?.id) {
          warehouse = selectedWarehouse;
        } else if (user.warehouse_id) {
          warehouse = { name: user.warehouse, id: user.warehouse_id };
        } else if (user.warehouse) {
          const found = await fetchWarehouseByName(user.warehouse);
          if (found) {
            warehouse = { name: found.name, id: found.id };
            const updatedUser = { ...user, warehouse_id: found.id };
            localStorage.setItem("user", JSON.stringify(updatedUser));
          }
        }
      } else {
        if (user.warehouse_id) {
          warehouse = { name: user.warehouse, id: user.warehouse_id };
        } else if (user.warehouse) {
          const found = await fetchWarehouseByName(user.warehouse);
          if (found) {
            warehouse = { name: found.name, id: found.id };
            const updatedUser = { ...user, warehouse_id: found.id };
            localStorage.setItem("user", JSON.stringify(updatedUser));
          }
        }
      }

      setCurrentWarehouse(warehouse);
      setIsLoadingWarehouse(false);
    };

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.id) setupWarehouse();
  }, [selectedWarehouseId, currentUserId]);

  // Axios config with warehouse header
  const getAxiosConfig = useCallback(() => {
    const cfg = {};
    if (currentWarehouse?.id) {
      cfg.headers = { "X-Warehouse-ID": currentWarehouse.id };
    }
    return cfg;
  }, [currentWarehouse?.id]);

  const fetchReceivings = useCallback(() => {
    if (!currentWarehouse?.id) return;
    const cfg = getAxiosConfig();
    axios
      .get("http://localhost:8080/api/receiving/", cfg)
      .then((res) => setReceivings(res.data))
      .catch((err) => console.error("[ReceivingList] Error fetching receivings:", err));
  }, [currentWarehouse?.id, getAxiosConfig]);

  useEffect(() => {
    if (currentWarehouse?.id && !isLoadingWarehouse) {
      fetchReceivings();
    }
  }, [currentWarehouse?.id, isLoadingWarehouse, fetchReceivings]);

  const handleDeleteReceiving = async () => {
    try {
      const cfg = getAxiosConfig();
      await axios.delete(
        `http://localhost:8080/api/receiving/${deleteModal.id}/`,
        cfg
      );
      fetchReceivings();
      setDeleteModal({ open: false, id: null });
    } catch (e) {
      console.error("[ReceivingList] Error deleting receiving:", e);
      // You could add a toast notification here
    }
  };

  if (!currentWarehouse || isLoadingWarehouse) {
    return (
      <div className="loading">
        <div className="spinner" />
        <div className="loading-text">Loading warehouse information…</div>
      </div>
    );
  }

  return (
    <div className="receiving-container">
      {/* Header */}
      <div className="page-header">
        <div className="warehouse-chip">
          <span className="chip-title">📦 Current Warehouse</span>
          <span className="chip-value">{currentWarehouse.name}</span>
          <span className="chip-sub">ID: {currentWarehouse.id}</span>
        </div>

        <div className="actions">
          <Link to="/receiving/new" className="btn btn-add">+ New Receiving</Link>
        </div>
      </div>

      {/* Table Card */}
      <div className="table-wrapper">
        <table className="table receiving-list-table">
        <thead>
          <tr>
            <th>Receive No</th>
            <th>Date</th>
            <th>Supplier</th>
            <th>Invoice</th>
            <th>Net Amount</th>
            <th className="w-128">Actions</th>
          </tr>
        </thead>
        <tbody>
          {receivings.length === 0 ? (
            <tr>
              <td colSpan="6" className="text-muted" style={{ textAlign: "center", padding: 24 }}>
                No receiving records found for {currentWarehouse.name}
              </td>
            </tr>
          ) : (
            receivings.map((item) => (
              <tr key={item.id}>
                <td>{item.receive_no}</td>
                <td>{new Date(item.date_time).toLocaleString()}</td>
                <td>{item.supplier_name}</td>
                <td>{item.invoice_no}</td>
                <td>₱{parseFloat(item.net_amount).toFixed(2)}</td>
                <td>
                  <div className="actions" style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                   <Link
                      className="icon-btn icon-btn-view"
                      title="View Details"
                      to={`/receiving/${item.id}`}
                    >
                      <FaEye />
                    </Link>
                    <button
                      className="icon-btn icon-btn-danger"
                      title="Delete"
                      onClick={() => setDeleteModal({ open: true, id: item.id })}
                    >
                      <FaTrashAlt />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>  

      {/* Modals */}
      <ReceiptModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        receipt={selectedReceipt}
      />

      <DeleteConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, id: null })}
        onConfirm={handleDeleteReceiving}
        receivingId={deleteModal.id}
      />
    </div>
  );
};

export default ReceivingList;