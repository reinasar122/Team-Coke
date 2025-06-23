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
      return `RCV-${Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')}`;
    };

    setReceiveNo(generateJumbledCode());
  }, []);

  const handleReturnChange = (value) => {
    const updatedReturnAmount = value === "" ? "" : Number(value);
    const total = form.details.reduce((sum, row) => sum + parseFloat(row.total || 0), 0);
    const net = total - (updatedReturnAmount === "" ? 0 : updatedReturnAmount);
    setForm({ ...form, return_total_amount: value, net_amount: net.toFixed(2) });
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...form.details];
    const row = newRows[index];

    row[field] = value === "" ? "" : Number(value);

    const product = products.find((p) => p.id === Number(row.product_id));
    const content_no = product?.unit_type?.content_no || 1;

    const shell_qty = row.shell_qty === "" || isNaN(row.shell_qty) ? 0 : Number(row.shell_qty);
    const bad_order_pcs = row.bad_order_pcs === "" || isNaN(row.bad_order_pcs) ? 0 : Number(row.bad_order_pcs);

    const raw_pcs = shell_qty * content_no;
    const adjusted_pcs = Math.max(0, raw_pcs - bad_order_pcs);

    if (field === "shell_qty" || field === "bad_order_pcs") {
      row.pcs_qty = adjusted_pcs;
      row.bottle_qty = adjusted_pcs;
    }

    if (product?.price) {
      const { purchase_price = 0, shell_price = 0, bottle_price = 0 } = product.price;
      const unit_cost = purchase_price + bottle_price + (shell_price / content_no);
      row.unit_cost = unit_cost.toFixed(2);
      row.total = (adjusted_pcs * unit_cost).toFixed(2);
    }

    const total = newRows.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
    const returnAmount = form.return_total_amount === "" ? 0 : Number(form.return_total_amount);
    const net = total - returnAmount;

    const isLastRow = index === newRows.length - 1;
    const rowFilled = row.product_id && row.shell_qty;

    if (isLastRow && rowFilled) {
      newRows.push({
        product_id: "",
        pcs_qty: 0,
        shell_qty: 0,
        bottle_qty: 0,
        bad_order_pcs: 0,
        unit_cost: 0,
        total: 0,
      });
    }

    setForm({ ...form, details: newRows, net_amount: net.toFixed(2) });
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

  const hasSelectedProduct = form.details.some(row => row.product_id);

  return (
    <form onSubmit={handleSubmit} className="max-w-[98%] mx-auto p-10 bg-white rounded-3xl shadow-lg space-y-10">
      
       {/* Remove spinner for all number fields */}
       <style>{`
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-gray-600 font-semibold mb-2">Receiving No:</label>
          <input type="text" value={receiveNo} readOnly className="w-full p-3 rounded-lg bg-gray-100 text-gray-800 font-bold border border-gray-300" />
        </div>
        <div>
          <label className="block text-gray-600 font-semibold mb-2">Supplier:</label>
          <select value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border-gray-300">
            <option value="">Select Supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.company_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-gray-600 font-semibold mb-2">Invoice No:</label>
          <input type="text" value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border-gray-300" />
        </div>
        <div>
          <label className="block text-gray-600 font-semibold mb-2">Return Total Amount:</label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-gray-500">₱</span>
            <input
              type="number"
              disabled={!hasSelectedProduct}
              value={form.return_total_amount}
              onFocus={(e) => e.target.value === "0" ? e.target.value = "" : null}
              onBlur={(e) => e.target.value === "" ? e.target.value = 0 : null}
              onChange={(e) => handleReturnChange(e.target.value)}
              className="w-full pl-8 p-3 rounded-lg bg-gray-100 border-gray-300 disabled:opacity-50"
            />
          </div>
        </div>
        <div>
          <label className="block text-gray-600 font-semibold mb-2">Net Amount:</label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-gray-500">₱</span>
            <input
              type="text"
              value={parseFloat(form.net_amount || 0).toFixed(2)}
              readOnly
              className="w-full pl-8 p-3 rounded-lg bg-gray-100 text-gray-800 font-bold"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto mt-8">
        <table className="w-full rounded-xl border-collapse shadow-md">
          <thead className="bg-[#0B1320] text-white">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Shell</th>
              <th className="p-3">PCS</th>
              <th className="p-3">BAD ORDERS  (PCs)</th>
              <th className="p-3">Unit Cost</th>
              <th className="p-3">Total</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {form.details.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="border-b p-2">
                  <select value={row.product_id} onChange={(e) => handleRowChange(index, "product_id", e.target.value)} className="w-full p-2 rounded-lg bg-gray-100 border-gray-300">
                    <option value="">Select Product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.product_name}</option>
                    ))}
                  </select>
                </td>
                <td className="border-b p-2">
                <input
                    type="number"
                    disabled={!row.product_id}
                    value={row.shell_qty}
                    onFocus={(e) => e.target.value === "0" ? e.target.value = "" : null}
                    onBlur={(e) => e.target.value === "" ? e.target.value = 0 : null}
                    onChange={(e) => handleRowChange(index, "shell_qty", e.target.value)}
                    className="w-full p-2 text-center rounded-lg bg-gray-100 border-gray-300 disabled:opacity-50"
                  />

                </td>
                <td className="border-b p-2">
                  <input type="number" value={row.pcs_qty} readOnly disabled className="w-full p-2 text-center rounded-lg bg-gray-100 text-gray-700" />
                </td>
                <td className="border-b p-2">
                <input
                    type="number"
                    disabled={!row.product_id}
                    value={row.bad_order_pcs}
                    onFocus={(e) => e.target.value === "0" ? e.target.value = "" : null}
                    onBlur={(e) => e.target.value === "" ? e.target.value = 0 : null}
                    onChange={(e) => handleRowChange(index, "bad_order_pcs", e.target.value)}
                    className="w-full p-2 text-center rounded-lg bg-gray-100 border-gray-300 disabled:opacity-50"
                  />
                </td>
                <td className="border-b p-2 text-right text-gray-700">₱{parseFloat(row.unit_cost || 0).toFixed(2)}</td>
                <td className="border-b p-2 text-right font-bold text-gray-700">₱{parseFloat(row.total || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-10">
        <div>
          <label className="block text-gray-600 font-semibold mb-2">Received By:</label>
          <select value={form.received_by} onChange={(e) => setForm({ ...form, received_by: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border-gray-300">
            <option value="">Select user</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-gray-600 font-semibold mb-2">Remarks:</label>
          <textarea rows="3" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border-gray-300" />
        </div>
      </div>

      <div className="flex justify-end gap-4 mt-10">
        <button type="button" onClick={() => navigate("/receiving")} className="px-6 py-3 bg-[#fb2222] hover:bg-[#ff3e3e] text-white rounded-full transition">
          Cancel
        </button>
        <button type="submit" className="px-6 py-3 bg-[#0B1320] hover:bg-[#1C2230] text-white rounded-full font-semibold transition">
          Save
        </button>
      </div>
    </form>
  );
};

export default ReceivingForm;