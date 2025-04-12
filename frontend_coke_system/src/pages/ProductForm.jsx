import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const ProductForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    system_code: '',
    supplier_code: '',
    product_name: '',
    product_category: '',
    purchase_price: '',
    selling_price: '',
    shell_price: '',
    bottle_price: '',
    content_no: '',
    shell_type: '',
    returnable: false,
    content_type: ''
  });
  
  const [shellTypes, setShellTypes] = useState([]);
  const [contentTypes, setContentTypes] = useState([]);


  useEffect(() => {
    axios.get('http://localhost:8080/api/shelltypes/').then(res => setShellTypes(res.data));
    axios.get('http://localhost:8080/api/contenttypes/').then(res => setContentTypes(res.data));

  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const pricingRes = await axios.post('http://localhost:8080/api/pricing/', {
        purchase_price: formData.purchase_price,
        selling_price: formData.selling_price,
        shell_price: formData.shell_price,
        bottle_price: formData.bottle_price
      });

      const unitTypeRes = await axios.post('http://localhost:8080/api/unit-types/', {
        content_no: formData.content_no,
        returnable: formData.returnable,
        shell_type: formData.shell_type,
        content_type: formData.content_type,
        content_returnable: formData.returnable
      });

      await axios.post('http://localhost:8080/api/products/', {
        system_code: formData.system_code,
        supplier_code: formData.supplier_code,
        product_name: formData.product_name,
        product_category: formData.product_category,
        unit_type: unitTypeRes.data.id,
        price: pricingRes.data.id
      });

      // ✅ Browser's alert box
    alert('✅ Product registered successfully!');
    
    navigate('/products');
  } catch (err) {
    console.error(err);
    alert('❌ Failed to create product');
  }
};


  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-8 bg-gray-300 p-6 rounded-xl shadow-lg">
      <h2 className="text-3xl font-bold mb-6">PRODUCT</h2>

      {[
        { label: 'System Code', name: 'system_code' },
        { label: 'Supplier Code', name: 'supplier_code' },
        { label: 'Product Name', name: 'product_name' },
      ].map(({ label, name }) => (
        <div className="mb-4" key={name}>
          <label className="block font-medium mb-1">{label}</label>
          <input
            name={name}
            value={formData[name]}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
      ))}

      <div className="mb-4">
        <label className="block font-medium mb-1">Product Category</label>
        <select
          name="product_category"
          value={formData.product_category}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="">-- Select --</option>
          <option value="Soft Drinks">Soft Drinks</option>
          <option value="Hydration">Hydration</option>
          <option value="Juices">Juices</option>
          <option value="Alcohol">Alcohol</option>
          <option value="Dairy">Dairy</option>
        </select>
      </div>

      <div className="mb-4">
  <label className="block font-medium mb-1">Returnable</label>
  <input
    type="checkbox"
    name="returnable"
    checked={formData.returnable}
    onChange={handleChange}
    className="mr-2"
  />
  <span>{formData.returnable ? "Yes" : "No"}</span>
</div>


      {[
        { label: 'Purchased Price', name: 'purchase_price' },
        { label: 'Selling Price', name: 'selling_price' },
        { label: 'Shell Price', name: 'shell_price' },
        { label: 'Bottle Price', name: 'bottle_price' },
        { label: 'Content No', name: 'content_no' },
      ].map(({ label, name }) => (
        <div className="mb-4" key={name}>
          <label className="block font-medium mb-1">{label}</label>
          <input
            name={name}
            type="number"
            value={formData[name]}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
      ))}

      <div className="mb-4">
        <label className="block font-medium mb-1">Shell Type</label>
        <select
          name="shell_type"
          value={formData.shell_type}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="">-- Select --</option>
          {shellTypes.map(shell => (
            <option key={shell.id} value={shell.id}>{shell.description}</option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <label className="block font-medium mb-1">Content Type</label>
        <select
          name="content_type"
          value={formData.content_type}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="">-- Select --</option>
          {contentTypes.map(content => (
            <option key={content.id} value={content.id}>{content.description}</option>
          ))}
        </select>
      </div>

      <div className="flex justify-between">
      <button
        type="button"
        onClick={() => navigate('/products')}
        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
      >
        Cancel
      </button>
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Save Product
      </button>
    </div>

    </form>
  );
};

export default ProductForm;
