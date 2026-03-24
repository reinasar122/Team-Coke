// src/pages/receiving/ReceivingDetails.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
// import "../../styles/pages/receivinglist.scss"; // reuse your existing styles
import api from "../api"; // ✅ correct

const peso = (v) => {
  const number = Number(v || 0);
  return `₱${number.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};


export default function ReceivingDetails() {
  const { id } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [users, setUsers] = useState([]);
  const [warehouse, setWarehouse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // --- same warehouse header logic as your list ---
  const getAxiosConfig = useCallback(() => {
    const cfg = {};
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const wid = selectedWarehouse?.id || user?.warehouse_id || null;
    if (wid) {
      cfg.headers = { "X-Warehouse-ID": wid };
    }
    return cfg;
  }, []);

  useEffect(() => {
    // resolve current warehouse for header chip
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const w =
      selectedWarehouse?.id
        ? selectedWarehouse
        : user?.warehouse_id
        ? { id: user.warehouse_id, name: user.warehouse }
        : null;
    setWarehouse(w);
  }, []);

  // load users (to show "Received By" full name)
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const cfg = getAxiosConfig();
        const res = await api.get("/users/", cfg);
        setUsers(res.data || []);
      } catch (e) {
        console.error("[ReceivingDetails] Error fetching users:", e);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [getAxiosConfig]);

  // load receipt
  useEffect(() => {
    const fetchReceipt = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const cfg = getAxiosConfig();
        const res = await api.get(`/receiving/${id}/`, cfg);
        setReceipt(res.data);
      } catch (e) {
        console.error("[ReceivingDetails] Error fetching receipt:", e);
        alert("Error loading receiving details.");
      } finally {
        setLoading(false);
      }
    };
    fetchReceipt();
  }, [id, getAxiosConfig]);

  const receivedByText = useMemo(() => {
    if (!receipt?.received_by) return "N/A";
    if (receipt.received_by_name) return receipt.received_by_name;
    const u = users.find((x) => x.id === Number(receipt.received_by));
    if (u) return `${u.first_name} ${u.last_name}`;
    if (receipt.receiver_first_name && receipt.receiver_last_name) {
      return `${receipt.receiver_first_name} ${receipt.receiver_last_name}`;
    }
    return typeof receipt.received_by === "number"
      ? `User ID: ${receipt.received_by}`
      : receipt.received_by;
  }, [receipt, users]);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <div className="loading-text">Loading receiving details…</div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="warehouse-chip">
            <span className="chip-title">📦 Current Warehouse</span>
            <span className="chip-value">{warehouse?.name || "N/A"}</span>
            {warehouse?.id && <span className="chip-sub">ID: {warehouse.id}</span>}
          </div>
          <div className="actions">
            <Link to="/receiving" className="btn btn-back">Back</Link>
          </div>
        </div>
        <div className="card" style={{ padding: 24 }}>Receipt not found.</div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div className="warehouse-chip">
          <span className="chip-title">📦 Current Warehouse</span>
          <span className="chip-value">{warehouse?.name || receipt.warehouse_name || "N/A"}</span>
          {warehouse?.id && <span className="chip-sub">ID: {warehouse.id}</span>}
        </div>
        <div className="actions">
          <Link to="/receiving" className="btn btn-back">Back</Link>
        </div>
      </div>

      {/* Receipt header */}
     
        <div className="receiving-receipt-header">
          <h2 className="page-title">Receipt No.</h2>
          <div className="receipt-no">#{receipt.invoice_no}</div>
          {(receipt.warehouse_name || warehouse?.name) && (
            <div className="muted">Warehouse: {receipt.warehouse_name || warehouse?.name}</div>
          )}
        </div>

        {/* Meta rows */}
        <div className="receipt-meta">
          <div className="meta-col">
            <p><strong>Date &amp; Time:</strong> {new Date(receipt.date_time).toLocaleString()}</p>
            <p><strong>Supplier:</strong> {receipt.supplier_name}</p>
            {/* <p><strong>Receipt No:</strong> {receipt.invoice_no}</p> */}
          </div>
          <div className="meta-col right">
            <p><strong>Received By:</strong> {loadingUsers ? "Loading…" : receivedByText}</p>
            <p>
              <strong>Return Total Amount:</strong> {peso(receipt.return_total_amount)}
            </p>
          </div>
        </div>

      {/* Items table */}
     
        <div className="table-wrapper mt-6">
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
              {(receipt.details || []).map((item, idx) => (
                <tr key={idx}>
                  <td>{item.product_name || item.item_name}</td>
                  <td>{item.shell_qty}</td>
                  <td>{item.pcs_qty}</td>
                  <td>{item.bad_order_pcs}</td>
                  <td>{peso(item.unit_price)}</td>
                  <td>{peso(item.shell_price)}</td>
                  <td>{peso(item.bottle_price)}</td>
                  <td>{peso(item.unit_cost)}</td>
                  <td><strong>{peso(item.total)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      {/* Remarks + totals */}
      {receipt.remarks && (
        <div className="card mt-6">
          <p className="label"><strong>Remarks:</strong></p>
          <p className="remarks-box">{receipt.remarks}</p>
        </div>
      )}

      <div className="totals">
        <div className="spacer" />
        <div className="text-right font-semibold mt-1">
          <strong>Net Amount:</strong> {peso(receipt.net_amount)}
        </div>
      </div>
    </div>
  );
}