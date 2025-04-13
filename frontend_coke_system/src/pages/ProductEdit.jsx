import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";

const ProductEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [formData, setFormData] = useState({
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
    price_id: null,
    unit_type_id: null,
  });

  const [categories, setCategories] = useState([]);
  const [shellTypes, setShellTypes] = useState([]);
  const [contentTypes, setContentTypes] = useState([]);

  const [showModal, setShowModal] = useState({ type: null });
  const [newValue, setNewValue] = useState("");

  const fetchDropdowns = () => {
    axios.get("http://localhost:8080/api/product-categories/").then((res) => setCategories(res.data));
    axios.get("http://localhost:8080/api/shelltypes/").then((res) => setShellTypes(res.data));
    axios.get("http://localhost:8080/api/contenttypes/").then((res) => setContentTypes(res.data));
  };

  const fetchProduct = async () => {
    try {
      const res = await axios.get(`http://localhost:8080/api/products/${id}/`);
      const product = res.data;

      setFormData({
        system_code: product.system_code,
        supplier_code: product.supplier_code,
        product_name: product.product_name,
        product_category: product.product_category?.id || "",
        returnable: product.unit_type?.returnable || true,
        purchase_price: product.price?.purchase_price || "",
        selling_price: product.price?.selling_price || "",
        shell_price: product.price?.shell_price ?? 0,
        bottle_price: product.price?.bottle_price ?? 0,
        content_no: product.unit_type?.content_no || "",
        shell_type: product.unit_type?.shell_type || "",
        content_type: product.unit_type?.content_type || "",
        price_id: product.price?.id || null,
        unit_type_id: product.unit_type?.id || null,
      });
    } catch (err) {
      console.error("❌ Failed to load product:", err);
    }
  };

  useEffect(() => {
    fetchDropdowns();
    fetchProduct();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;

    if (name === "returnable" && !checked) {
      setFormData((prev) => ({
        ...prev,
        returnable: false,
        shell_price: 0,
        bottle_price: 0,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: val }));
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      // ✅ Update existing Pricing
      await axios.put(`http://localhost:8080/api/pricing/${formData.price_id}/`, {
        purchase_price: parseFloat(formData.purchase_price) || 0,
        selling_price: parseFloat(formData.selling_price) || 0,
        shell_price: parseFloat(formData.shell_price) || 0,
        bottle_price: parseFloat(formData.bottle_price) || 0,
      });

      // ✅ Update existing UnitType
      await axios.put(`http://localhost:8080/api/unit-types/${formData.unit_type_id}/`, {
        content_no: formData.content_no,
        returnable: formData.returnable,
        shell_type: formData.shell_type,
        content_type: formData.content_type,
        content_returnable: formData.returnable,
      });

      // ✅ Update the Product
      await axios.put(`http://localhost:8080/api/products/${id}/`, {
        system_code: formData.system_code,
        supplier_code: formData.supplier_code,
        product_name: formData.product_name,
        product_category: formData.product_category,
        unit_type: formData.unit_type_id,
        price: formData.price_id,
      });

      alert("✅ Product updated!");
      navigate("/products");
    } catch (err) {
      console.error("❌ Update Error:", err.response?.data || err.message);
      alert("❌ Failed to update product.");
    }
  };

  const handleAddNew = async () => {
    let endpoint = "";
    let payload = {};

    if (showModal.type === "category") {
      endpoint = "product-categories/";
      payload = { name: newValue };
    } else if (showModal.type === "shell") {
      endpoint = "shelltypes/";
      payload = { description: newValue };
    } else if (showModal.type === "content") {
      endpoint = "contenttypes/";
      payload = { description: newValue };
    }

    try {
      const res = await axios.post(`http://localhost:8080/api/${endpoint}`, payload);
      fetchDropdowns();
      setFormData((prev) => ({
        ...prev,
        [`${showModal.type}_type`]: res.data.id,
        product_category: showModal.type === "category" ? res.data.id : prev.product_category,
      }));
      setShowModal({ type: null });
      setNewValue("");
    } catch (err) {
      console.error("❌ Add New Error:", err.response?.data || err.message);
      alert("❌ Failed to add new item");
    }
  };

  const renderDropdown = (label, name, options, modalType) => (
    <div className="mb-4">
      <label className="block font-medium mb-1">{label}</label>
      <select
        name={name}
        value={formData[name]}
        onChange={(e) => {
          if (e.target.value === "add_new") {
            setShowModal({ type: modalType });
          } else {
            handleChange(e);
          }
        }}
        className="w-full px-3 py-2 border rounded"
      >
        <option value="">-- Select --</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name || item.description}
          </option>
        ))}
        <option value="add_new">+ Add New</option>
      </select>
    </div>
  );

  return (
    <form onSubmit={handleUpdate} className="max-w-md mx-auto mt-8 bg-gray-200 p-6 rounded-xl shadow-lg">
      <h2 className="text-3xl font-bold mb-6">EDIT PRODUCT</h2>

      {[
        ["System Code", "system_code"],
        ["Supplier Code", "supplier_code"],
        ["Product Name", "product_name"],
      ].map(([label, name]) => (
        <div className="mb-4" key={name}>
          <label className="block font-medium mb-1">{label}</label>
          <input
            name={name}
            value={formData[name]}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded"
            readOnly={name === "system_code"}
          />
        </div>
      ))}

      {renderDropdown("Product Category", "product_category", categories, "category")}

      <div className="mb-4 flex items-center">
        <label className="font-medium mr-4">RETURNABLE</label>
        <input type="checkbox" name="returnable" checked={formData.returnable} onChange={handleChange} />
        <span className="ml-2">{formData.returnable ? "YES" : "NO"}</span>
      </div>

      {[
        ["Purchased Price", "purchase_price"],
        ["Selling Price", "selling_price"],
        ["Shell Price", "shell_price"],
        ["Bottle Price", "bottle_price"],
        ["Content No", "content_no"],
      ].map(([label, name]) => (
        <div className="mb-4" key={name}>
          <label className="block font-medium mb-1">{label}</label>
          <input
            name={name}
            type="number"
            value={formData[name]}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded"
            readOnly={["shell_price", "bottle_price"].includes(name) && !formData.returnable}
          />
        </div>
      ))}

      {renderDropdown("Shell Type", "shell_type", shellTypes, "shell")}
      {renderDropdown("Content Type", "content_type", contentTypes, "content")}

      <div className="flex justify-between">
        <button type="button" onClick={() => navigate("/products")} className="bg-gray-500 text-white px-4 py-2 rounded">
          Cancel
        </button>
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
          Update Product
        </button>
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
              <button onClick={() => setShowModal({ type: null })} className="px-3 py-1 bg-gray-400 text-white rounded">
                Cancel
              </button>
              <button onClick={handleAddNew} className="px-3 py-1 bg-blue-600 text-white rounded">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

export default ProductEdit;
