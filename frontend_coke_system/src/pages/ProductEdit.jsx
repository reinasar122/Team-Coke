import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";

const ProductEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [formData, setFormData] = useState({
    system_code: "",
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
    price_id: null,
    unit_type_id: null,
    warehouse: null,
  });
  
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [shellTypes, setShellTypes] = useState([]);
  const [contentTypes, setContentTypes] = useState([]);
  const [showModal, setShowModal] = useState({ type: null });
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

  const fetchDropdowns = async () => {
    try {
      const categoriesRes = await axios.get("http://localhost:8080/api/product-categories/");
      const shellTypesRes = await axios.get("http://localhost:8080/api/shelltypes/");
      const contentTypesRes = await axios.get("http://localhost:8080/api/contenttypes/");
      const suppliersRes = await axios.get("http://localhost:8080/api/suppliers/");
      
      setCategories(categoriesRes.data);
      setShellTypes(shellTypesRes.data);
      setContentTypes(contentTypesRes.data);
      setSuppliers(suppliersRes.data);
    } catch (err) {
      console.error("Error fetching dropdowns:", err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await fetchDropdowns();
      
      try {
        const warehouseId = getCurrentWarehouse();
        const res = await axios.get(`http://localhost:8080/api/products/${id}/?warehouse_id=${warehouseId}`);
        const product = res.data;
        
        console.log("Full product data:", JSON.stringify(product));
        
        // Check if product belongs to current warehouse
        if (product.warehouse !== warehouseId) {
          alert("⚠️ You don't have access to edit this product from another warehouse.");
          navigate("/products");
          return;
        }
        
        const categoryId = product.product_category?.id || product.product_category;
        
        setFormData({
          system_code: product.system_code || "",
          supplier_code: product.supplier_code || "",
          supplier: product.supplier || "",
          product_name: product.product_name || "",
          product_category: categoryId || "",
          returnable: product.unit_type?.returnable ?? true,
          purchase_price: product.price?.purchase_price ?? 0,
          selling_price: product.price?.selling_price ?? 0,
          shell_price: product.price?.shell_price ?? 0,
          bottle_price: product.price?.bottle_price ?? 0,
          content_no: product.unit_type?.content_no || "",
          shell_type: product.unit_type?.shell_type || "",
          content_type: product.unit_type?.content_type || "",
          price_id: product.price?.id || null,
          unit_type_id: product.unit_type?.id || null,
          warehouse: product.warehouse || warehouseId,
        });
      } catch (err) {
        console.error("❌ Failed to load product:", err);
        alert("Failed to load product data");
        navigate("/products");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

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
      console.log("Updating product with form data:", JSON.stringify(formData));
      
      // 1. Update pricing
      await axios.put(`http://localhost:8080/api/pricing/${formData.price_id}/`, {
        purchase_price: parseFloat(formData.purchase_price) || 0,
        selling_price: parseFloat(formData.selling_price) || 0,
        shell_price: parseFloat(formData.shell_price) || 0,
        bottle_price: parseFloat(formData.bottle_price) || 0,
      });

      // 2. Update unit type
      await axios.put(`http://localhost:8080/api/unit-types/${formData.unit_type_id}/`, {
        content_no: formData.content_no,
        returnable: formData.returnable,
        shell_type: formData.shell_type,
        content_type: formData.content_type,
        content_returnable: formData.returnable,
      });

      // 3. Update product (including warehouse)
      const productUpdatePayload = {
        system_code: formData.system_code,
        supplier_code: formData.supplier_code,
        supplier: formData.supplier,
        product_name: formData.product_name,
        product_category: formData.product_category,
        unit_type: formData.unit_type_id,
        price: formData.price_id,
        warehouse: formData.warehouse,
      };
      
      console.log("Final product update payload:", JSON.stringify(productUpdatePayload));
      
      await axios.put(`http://localhost:8080/api/products/${id}/`, productUpdatePayload);

      alert("✅ Product updated successfully!");
      
      // Navigate back to products list
      navigate("/products", { 
        state: { 
          refresh: true, 
          timestamp: new Date().getTime() 
        }, 
        replace: true 
      });
    } catch (err) {
      console.error("❌ Update Error:", err.response?.data || err.message);
      alert("❌ Failed to update product: " + (err.response?.data?.message || err.message));
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
    } else if (showModal.type === "supplier") {
      endpoint = "suppliers/";
      payload = { company_name: newValue };
      fieldName = "supplier";
    }

    try {
      const res = await axios.post(`http://localhost:8080/api/${endpoint}`, payload);
      console.log(`Added new ${showModal.type}:`, JSON.stringify(res.data));
      
      await fetchDropdowns();
      
      setFormData((prev) => ({
        ...prev,
        [fieldName]: res.data.id,
      }));
      setShowModal({ type: null });
      setNewValue("");
    } catch (err) {
      console.error("❌ Add New Error:", err.response?.data || err.message);
      alert("❌ Failed to add new item");
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-blue-100 shadow-xl rounded-xl dark:bg-gray-800">
        <h2 className="text-3xl font-bold text-center mb-4 dark:text-white">Loading product data...</h2>
      </div>
    );
  }

  return (
    <form onSubmit={handleUpdate} className="p-6 bg-blue-100 shadow-xl rounded-xl overflow-x-auto dark:bg-gray-800">
      <h2 className="text-3xl font-bold text-center mb-4 dark:text-white">PRODUCT EDIT FORM</h2>
      <table className="min-w-full table-auto border-collapse">
        <thead className="bg-gray-400 text-black dark:bg-gray-600 dark:text-white">
          <tr>
            {["System Code", "Supplier Code", "Supplier", "Product Name", "Product Category", "Returnable", "Purchase Price", "Selling Price", "Shell Price", "Bottle Price", "Content No", "Shell Type", "Content Type"].map(header => (
              <th key={header} className="px-4 py-2">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-gray-200 dark:bg-gray-700">
          <tr>
            <td className="px-2 py-2">
              <input 
                name="system_code" 
                value={formData.system_code} 
                readOnly 
                className="border rounded px-2 py-1 w-full bg-gray-100 dark:bg-gray-600 dark:text-white" 
              />
            </td>
            <td className="px-2 py-2">
              <input 
                name="supplier_code" 
                value={formData.supplier_code} 
                onChange={handleChange} 
                className="border rounded px-2 py-1 w-full dark:bg-gray-800 dark:text-white" 
              />
            </td>
            <td className="px-2 py-2">
              <select 
                name="supplier" 
                value={formData.supplier || ""} 
                onChange={(e) => {
                  if (e.target.value === "add_new") {
                    setShowModal({ type: "supplier" });
                  } else {
                    handleChange(e);
                  }
                }} 
                className="border rounded px-2 py-1 w-full dark:bg-gray-800 dark:text-white"
              >
                <option value="">--Supplier--</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.company_name || s.name || `Supplier ${s.id}`}
                  </option>
                ))}
                <option value="add_new">+ Add New</option>
              </select>
            </td>
            <td className="px-2 py-2">
              <input 
                name="product_name" 
                value={formData.product_name} 
                onChange={handleChange} 
                className="border rounded px-2 py-1 w-full dark:bg-gray-800 dark:text-white" 
              />
            </td>
            <td className="px-2 py-2">
              <select 
                name="product_category" 
                value={formData.product_category} 
                onChange={(e) => {
                  if (e.target.value === "add_new") {
                    setShowModal({ type: "category" });
                  } else {
                    handleChange(e);
                  }
                }} 
                className="border rounded px-2 py-1 w-full dark:bg-gray-800 dark:text-white"
              >
                <option value="">-- Select --</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
                <option value="add_new">+ Add New</option>
              </select>
            </td>
            <td className="px-2 py-2 text-center">
              <input 
                type="checkbox" 
                name="returnable" 
                checked={formData.returnable} 
                onChange={handleChange} 
                className="w-5 h-5 accent-[#5D5CDE]"
              />
            </td>
            <td className="px-2 py-2">
              <input 
                type="number" 
                name="purchase_price" 
                value={formData.purchase_price} 
                onChange={handleChange} 
                className="border rounded px-2 py-1 w-full dark:bg-gray-800 dark:text-white" 
              />
            </td>
            <td className="px-2 py-2">
              <input 
                type="number" 
                name="selling_price" 
                value={formData.selling_price} 
                onChange={handleChange} 
                className="border rounded px-2 py-1 w-full dark:bg-gray-800 dark:text-white" 
              />
            </td>
            <td className="px-2 py-2">
              <input 
                type="number" 
                name="shell_price" 
                value={formData.shell_price} 
                onChange={handleChange} 
                disabled={!formData.returnable} 
                className={`border rounded px-2 py-1 w-full dark:text-white ${!formData.returnable ? "bg-gray-100 dark:bg-gray-600" : "dark:bg-gray-800"}`} 
              />
            </td>
            <td className="px-2 py-2">
              <input 
                type="number" 
                name="bottle_price" 
                value={formData.bottle_price} 
                onChange={handleChange} 
                disabled={!formData.returnable} 
                className={`border rounded px-2 py-1 w-full dark:text-white ${!formData.returnable ? "bg-gray-100 dark:bg-gray-600" : "dark:bg-gray-800"}`} 
              />
            </td>
            <td className="px-2 py-2">
              <input 
                type="text" 
                name="content_no" 
                value={formData.content_no} 
                onChange={handleChange} 
                className="border rounded px-2 py-1 w-full dark:bg-gray-800 dark:text-white" 
              />
            </td>
            <td className="px-2 py-2">
              <select 
                name="shell_type" 
                value={formData.shell_type} 
                onChange={(e) => {
                  if (e.target.value === "add_new") {
                    setShowModal({ type: "shell" });
                  } else {
                    handleChange(e);
                  }
                }} 
                className="border rounded px-2 py-1 w-full dark:bg-gray-800 dark:text-white"
              >
                <option value="">-- Select --</option>
                {shellTypes.map(shell => (
                  <option key={shell.id} value={shell.id}>{shell.description}</option>
                ))}
                <option value="add_new">+ Add New</option>
              </select>
            </td>
            <td className="px-2 py-2">
              <select 
                name="content_type" 
                value={formData.content_type} 
                onChange={(e) => {
                  if (e.target.value === "add_new") {
                    setShowModal({ type: "content" });
                  } else {
                    handleChange(e);
                  }
                }} 
                className="border rounded px-2 py-1 w-full dark:bg-gray-800 dark:text-white"
              >
                <option value="">-- Select --</option>
                {contentTypes.map(content => (
                  <option key={content.id} value={content.id}>{content.description}</option>
                ))}
                <option value="add_new">+ Add New</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="mt-4 text-right">
        <button type="button" className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700" onClick={() => navigate('/products')}>Cancel</button>
        <button type="submit" className="px-4 py-2 ml-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800">Save Product</button>
      </div>

      {showModal.type && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl w-80 dark:bg-gray-800">
            <h3 className="text-lg font-bold mb-4 dark:text-white">Add New {showModal.type.charAt(0).toUpperCase() + showModal.type.slice(1)}</h3>
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="w-full px-3 py-2 border rounded mb-4 text-base dark:bg-gray-700 dark:text-white dark:border-gray-600"
              placeholder="Enter value"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal({ type: null })} className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button type="button" onClick={handleAddNew} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800">
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