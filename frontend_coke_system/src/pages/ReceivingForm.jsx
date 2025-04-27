import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const ReceivingForm = () => {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [receiveNo, setReceiveNo] = useState("");

  const [form, setForm] = useState({
    supplier: "",
    invoice_no: "",
    return_total_amount: 0,
    net_amount: 0,
    received_by: "",
    remarks: "",
    details: [
      {
        product_id: "",
        pcs_qty: 0,
        shell_qty: 0,
        bottle_qty: 0,
        bad_order_pcs: 0,
        unit_price: 0,
        shell_price: 0,
        bottle_price: 0,
        unit_cost: 0,
        total: 0,
      },
    ],
  });

  useEffect(() => {
    axios.get("http://localhost:8080/api/suppliers/").then((res) => setSuppliers(res.data));
    axios.get("http://localhost:8080/api/products/").then((res) => setProducts(res.data));
    axios.get("http://localhost:8080/api/users/").then((res) => setUsers(res.data));

    const generateJumbledCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      return `RCV-${Array.from({ length: 6 }, () =>
        chars[Math.floor(Math.random() * chars.length)]).join('')}`;
    };

    setReceiveNo(generateJumbledCode());
  }, []);

  const handleRowChange = (index, field, value) => {
    const newRows = [...form.details];
    const row = newRows[index];

    if (field === "product_id") {
      row[field] = value;
    } else {
      row[field] = value === "" ? "" : Number(value);
    }

    const product = products.find((p) => p.id === Number(row.product_id));
    const content_no = product?.unit_type?.content_no || 1;

    const shell_qty = row.shell_qty === "" ? 0 : Number(row.shell_qty);
    const pcs_qty = row.pcs_qty === "" ? 0 : Number(row.pcs_qty);
    const bad_order_pcs = row.bad_order_pcs === "" ? 0 : Number(row.bad_order_pcs);

    if (field === "shell_qty" && value !== "") {
      row.pcs_qty = shell_qty * content_no;
      row.bottle_qty = row.pcs_qty;
    }

    const adjusted_pcs = Math.max(0, row.pcs_qty - bad_order_pcs);

    if (product?.price) {
      const unit_price = product.price.purchase_price || 0;
      const shell_price = product.price.shell_price || 0;
      const bottle_price = product.price.bottle_price || 0;
      const unit_cost = unit_price + bottle_price + (shell_price / content_no);
      row.unit_price = unit_price;
      row.shell_price = shell_price;
      row.bottle_price = bottle_price;
      row.unit_cost = unit_cost.toFixed(2);
      row.total = (adjusted_pcs * unit_cost).toFixed(2);
    }

    const total = newRows.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
    const returnAmount = form.return_total_amount === "" ? 0 : Number(form.return_total_amount);
    const net = total - returnAmount;

    const isLastRow = index === newRows.length - 1;
    const rowFilled = row.product_id && (row.shell_qty !== "" && row.shell_qty !== 0);

    if (isLastRow && rowFilled) {
      newRows.push({
        product_id: "",
        pcs_qty: 0,
        shell_qty: 0,
        bottle_qty: 0,
        bad_order_pcs: 0,
        unit_price: 0,
        shell_price: 0,
        bottle_price: 0,
        unit_cost: 0,
        total: 0,
      });
    }

    setForm({ ...form, details: newRows, net_amount: net.toFixed(2) });
  };

  const handleReturnChange = (value) => {
    const updatedReturnAmount = value === "" ? "" : Number(value);
    const total = form.details.reduce((sum, row) => sum + parseFloat(row.total || 0), 0);
    const net = total - (updatedReturnAmount === "" ? 0 : updatedReturnAmount);

    setForm({ ...form, return_total_amount: value, net_amount: net.toFixed(2) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const filteredRows = form.details.filter(row =>
      row.product_id && (row.shell_qty !== "" && row.shell_qty !== 0)
    );

    const dataToSubmit = {
      ...form,
      receive_no: receiveNo,
      details: filteredRows,
      return_total_amount: form.return_total_amount === "" ? 0 : form.return_total_amount,
    };

    try {
      await axios.post("http://localhost:8080/api/receiving/", dataToSubmit);
      alert("Receiving saved!");
      navigate("/receiving");
    } catch (error) {
      console.error("Save failed:", error);
      alert("Save failed! See console for details.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-gray-100 space-y-6 rounded">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label>Receiving No:</label>
          <input type="text" value={receiveNo} readOnly className="w-full p-2 border rounded bg-white font-semibold" />
        </div>
        <div>
          <label>Supplier:</label>
          <select value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="w-full p-2 border rounded" required>
            <option value="">Select Supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.company_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Invoice No:</label>
          <input type="text" value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} className="w-full p-2 border rounded" />
        </div>
        <div className="relative">
          <label>Return Total Amount:</label>
          <span className="absolute inset-y-8 left-3 flex text-black">₱</span>
          <input
            type="number"
            value={form.return_total_amount}
            onChange={(e) => handleReturnChange(e.target.value)}
            className="w-full p-2 pl-7 border rounded"
          />
        </div>
        <div className="relative">
          <label>Net Amount:</label>
          <span className="absolute inset-y-8 left-3 flex text-black">₱</span>
          <input type="number" value={form.net_amount} readOnly className="w-full p-2 pl-7 border rounded bg-white font-semibold" />
        </div>
      </div>

      {/* Details Table */}
      <table className="w-full border mt-6 text-sm text-center">
        <thead className="bg-purple-200 text-gray-800">
          <tr>
            <th className="border p-2">Product</th>
            <th className="border p-2">Shell</th>
            <th className="border p-2">PCS</th>
            <th className="border p-2">BO/PCs</th>
            <th className="border p-2">Unit Cost</th>
            <th className="border p-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {form.details.map((row, index) => (
            <tr key={index}>
              <td className="border p-1">
                <select value={row.product_id} onChange={(e) => handleRowChange(index, "product_id", e.target.value)} className="w-full border p-1">
                  <option value="">Select Product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.product_name}</option>
                  ))}
                </select>
              </td>
              <td className="border p-1">
                <input type="number" value={row.shell_qty} onChange={(e) => handleRowChange(index, "shell_qty", e.target.value)} className="w-full text-center bg-white" />
              </td>
              <td className="border p-1">
                <input type="number" value={row.pcs_qty} readOnly disabled className="w-full text-center bg-white text-gray-700" />
              </td>
              <td className="border p-1">
                <input type="number" value={row.bad_order_pcs} onChange={(e) => handleRowChange(index, "bad_order_pcs", e.target.value)} className="w-full text-center" />
              </td>
              <td className="border p-1 text-right">₱{row.unit_cost}</td>
              <td className="border p-1 font-bold text-right">₱{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        <div>
          <label>Received By:</label>
          <select value={form.received_by} onChange={(e) => setForm({ ...form, received_by: e.target.value })} className="w-full p-2 border rounded" required>
            <option value="">Select user</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Remarks:</label>
          <textarea rows="3" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="w-full p-2 border rounded" />
        </div>
      </div>

      <div className="flex justify-end gap-4 mt-6">
        <button type="button" onClick={() => navigate("/receiving")} className="bg-gray-500 text-white px-6 py-2 rounded">
          Cancel
        </button>
        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
          Save
        </button>
      </div>
    </form>
  );
};

export default ReceivingForm;