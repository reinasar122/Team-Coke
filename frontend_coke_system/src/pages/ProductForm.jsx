import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const ProductForm = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([
    {
      system_code: "",
      supplier_code: "",
      product_name: "",
      product_category: "",
      returnable: true,
      purchase_price: "",
      selling_price: "",
      shell_price: "",
      bottle_price: "",
      content_no: "",
      shell_type: "",
      content_type: "",
    }
  ]);
  const inputRefs = useRef([]);

  const [categories, setCategories] = useState([]);
  const [shellTypes, setShellTypes] = useState([]);
  const [contentTypes, setContentTypes] = useState([]);
  const [showModal, setShowModal] = useState({ type: null, rowIndex: null });
  const [newValue, setNewValue] = useState("");
  const [suppliers, setSuppliers] = useState([]);

  // Get current warehouse from user session
  const getCurrentWarehouse = () => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    
    // For admin users, use selected warehouse if available, otherwise use enrolled warehouse
    if (userData.role?.toLowerCase() === "admin") {
      return selectedWarehouse?.id || userData.warehouse_id;
    }
    // For non-admin users, always use their enrolled warehouse
    return userData.warehouse_id;
  };

  useEffect(() => {
    fetchDropdowns();
    generateSystemCode(0);
  }, []);

  const fetchDropdowns = () => {
    axios.get("http://localhost:8080/api/product-categories/").then((res) => setCategories(res.data));
    axios.get("http://localhost:8080/api/shelltypes/").then((res) => setShellTypes(res.data));
    axios.get("http://localhost:8080/api/contenttypes/").then((res) => setContentTypes(res.data));
    axios.get("http://localhost:8080/api/suppliers/").then((res) => setSuppliers(res.data));
  };

  const generateSystemCode = (index) => {
    const code = `PROD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    setRows(prev => {
      const newRows = [...prev];
      newRows[index].system_code = code;
      return newRows;
    });
  };

  const handleChange = (index, e) => {
    const { name, value, type, checked } = e.target;
    setRows(prev => {
      const newRows = [...prev];
      if (name === "returnable") {
        newRows[index][name] = checked;
        if (!checked) {
          newRows[index].shell_price = 0;
          newRows[index].bottle_price = 0;
        }
      } else {
        newRows[index][name] = type === "checkbox" ? checked : value;
      }
      return newRows;
    });
    checkAndAddRow(index);
  };

  const handleSelectChange = (index, e, type) => {
    if (e.target.value === "add_new") {
      setShowModal({ type, rowIndex: index });
    } else {
      handleChange(index, e);
    }
  };

  const handleAddNew = async () => {
    let endpoint = "";
    let payload = {};
    let fieldName = "";

    if (showModal.type === "category") {
      endpoint = "product-categories/";
      payload = { name: newValue };
      fieldName = "product_category";
    } else if (showModal.type === "shell") {
      endpoint = "shelltypes/";
      payload = { description: newValue };
      fieldName = "shell_type";
    } else if (showModal.type === "content") {
      endpoint = "contenttypes/";
      payload = { description: newValue };
      fieldName = "content_type";
    }

    try {
      const res = await axios.post(`http://localhost:8080/api/${endpoint}`, payload);
      fetchDropdowns();
      setRows(prev => {
        const newRows = [...prev];
        newRows[showModal.rowIndex][fieldName] = res.data.id;
        return newRows;
      });
      setShowModal({ type: null, rowIndex: null });
      setNewValue("");
    } catch (err) {
      console.error("❌ Add New Error:", err.response?.data || err.message);
      alert("❌ Failed to add new item");
    }
  };

  const checkAndAddRow = (index) => {
    const current = rows[index];
    const filled = current.supplier_code && current.product_name && current.product_category && current.purchase_price && current.selling_price && current.content_no;
    if (filled && index === rows.length - 1) {
      setRows(prev => {
        const newRows = [...prev, {
          system_code: `PROD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          supplier_code: "",
          supplier: "", 
          product_name: "",
          product_category: "",
          returnable: true,
          purchase_price: "",
          selling_price: "",
          shell_price: "",
          bottle_price: "",
          content_no: "",
          shell_type: "",
          content_type: "",
        }];
        setTimeout(() => {
          inputRefs.current[newRows.length - 1]?.focus();
        }, 100);
        return newRows;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const currentWarehouse = getCurrentWarehouse();
    if (!currentWarehouse) {
      alert("❌ No warehouse assigned. Please contact administrator.");
      return;
    }

    try {
      for (let formData of rows) {
        if (!formData.product_name) continue;

        const pricingRes = await axios.post("http://localhost:8080/api/pricing/", {
          purchase_price: formData.purchase_price,
          selling_price: formData.selling_price,
          shell_price: formData.shell_price,
          bottle_price: formData.bottle_price,
        });

        const unitTypeRes = await axios.post("http://localhost:8080/api/unit-types/", {
          content_no: formData.content_no,
          returnable: formData.returnable,
          shell_type: formData.shell_type,
          content_type: formData.content_type,
          content_returnable: formData.returnable,
        });

        // Include warehouse in product creation
        await axios.post("http://localhost:8080/api/products/", {
          system_code: formData.system_code,
          supplier_code: formData.supplier_code,
          supplier: formData.supplier, 
          product_name: formData.product_name,
          product_category: formData.product_category,
          unit_type: unitTypeRes.data.id,
          price: pricingRes.data.id,
          warehouse: currentWarehouse,  // Add warehouse
        });
      }
      alert("✅ Products saved to your warehouse!");
      navigate("/products/");
    } catch (err) {
      console.log("Form values when saving:", rows);
      console.error("❌ Save Error:", err.response?.data || err.message);
      alert("❌ Error saving products: " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-blue-100 shadow-xl rounded-xl overflow-x-auto">
      <h2 className="text-3xl font-bold text-center mb-4">PRODUCT FORM</h2>
      <table className="min-w-full table-auto border-collapse">
        <thead className="bg-gray-400 text-black">
          <tr>
            {["System Code", "Supplier Code", "Supplier", "Product Name", "Product Category", "Returnable", "Purchase Price", "Selling Price", "Shell Price", "Bottle Price", "Content No", "Shell Type", "Content Type"].map(header => (
              <th key={header} className="px-4 py-2">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-gray-200">
          {rows.map((row, index) => (
            <tr key={index}>
              <td className="px-2 py-2"><input name="system_code" value={row.system_code} readOnly className="border rounded px-2 py-1 w-full" /></td>
              <td className="px-2 py-2"><input ref={(el) => inputRefs.current[index] = el} name="supplier_code" value={row.supplier_code} onChange={(e) => handleChange(index, e)} className="border rounded px-2 py-1 w-full" /></td>
              <td className="px-2 py-2"><select name="supplier" value={row.supplier || ""} onChange={(e) => handleChange(index, e)} className="border rounded px-2 py-1 w-full">
                <option value="">--Supplier--</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.company_name}</option>
                ))}
              </select>
            </td>
              <td className="px-2 py-2"><input name="product_name" value={row.product_name} onChange={(e) => handleChange(index, e)} className="border rounded px-2 py-1 w-full" /></td>
              <td className="px-2 py-2">
                <select name="product_category" value={row.product_category} onChange={(e) => handleSelectChange(index, e, 'category')} className="border rounded px-2 py-1 w-full">
                  <option value="">-- Select --</option>
                  {categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                  <option value="add_new">+ Add New</option>
                </select>
              </td>
              <td className="px-2 py-2 text-center">
                <input type="checkbox" name="returnable" checked={row.returnable} onChange={(e) => handleChange(index, e)} />
              </td>
              {["purchase_price", "selling_price", "shell_price", "bottle_price", "content_no"].map(field => (
                <td key={field} className="px-2 py-2">
                  <input
                    type="number"
                    name={field}
                    value={row[field]}
                    onChange={(e) => handleChange(index, e)}
                    className="border rounded px-2 py-1 w-full"
                    disabled={!row.returnable && (field === "shell_price" || field === "bottle_price")}
                  />
                </td>
              ))}
              <td className="px-2 py-2">
                <select name="shell_type" value={row.shell_type} onChange={(e) => handleSelectChange(index, e, 'shell')} className="border rounded px-2 py-1 w-full">
                  <option value="">-- Select --</option>
                  {shellTypes.map(shell => (<option key={shell.id} value={shell.id}>{shell.description}</option>))}
                  <option value="add_new">+ Add New</option>
                </select>
              </td>
              <td className="px-2 py-2">
                <select name="content_type" value={row.content_type} onChange={(e) => handleSelectChange(index, e, 'content')} className="border rounded px-2 py-1 w-full">
                  <option value="">-- Select --</option>
                  {contentTypes.map(content => (<option key={content.id} value={content.id}>{content.description}</option>))}
                  <option value="add_new">+ Add New</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 text-right">
        <button type="button" className="px-4 py-2 bg-gray-500 text-white rounded" onClick={() => navigate('/products')}>Cancel</button>
        <button type="submit" className="px-4 py-2 ml-2 bg-blue-600 text-white rounded">Save Product</button>
      </div>

      {showModal.type && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl w-80">
            <h3 className="text-lg font-bold mb-4">Add New {showModal.type.toUpperCase()}</h3>
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="w-full px-3 py-2 border rounded mb-4"
              placeholder="Enter value"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal({ type: null, rowIndex: null })} className="px-3 py-1 bg-gray-400 text-white rounded">
                Cancel
              </button>
              <button type="button" onClick={handleAddNew} className="px-3 py-1 bg-blue-600 text-white rounded">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

export default ProductForm;