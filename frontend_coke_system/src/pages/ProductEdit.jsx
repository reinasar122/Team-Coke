import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

const ProductEdit = () => {
  const { id } = useParams(); // get product ID from URL
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    system_code: '',
    supplier_code: '',
    product_name: '',
    product_category: '',
    returnable: false,
    purchase_price: '',
    selling_price: '',
    shell_price: '',
    bottle_price: '',
    content_no: '',
    shell_type: '',
    content_type: '',
  });

  const [shellTypes, setShellTypes] = useState([]);
  const [contentTypes, setContentTypes] = useState([]);

  useEffect(() => {
    // Fetch dropdown options
    axios.get('/shell-types/').then(res => setShellTypes(res.data));
    axios.get('/content-types/').then(res => setContentTypes(res.data));

    // Fetch product to edit
    axios.get(`/products/${id}/`)
      .then(res => {
        const product = res.data;
        setFormData({
          system_code: product.system_code,
          supplier_code: product.supplier_code,
          product_name: product.product_name,
          product_category: product.product_category,
          returnable: product.unit_type.returnable,
          purchase_price: product.price.purchase_price,
          selling_price: product.price.selling_price,
          shell_price: product.price.shell_price,
          bottle_price: product.price.bottle_price,
          content_no: product.unit_type.content_no,
          shell_type: product.unit_type.shell_type,
          content_type: product.unit_type.content_type,
        });
      })
      .catch(err => console.error('Error fetching product:', err));
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    axios.put(`/products/${id}/`, formData)
      .then(() => navigate('/products'))
      .catch(err => console.error('Error updating product:', err));
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-100 shadow-md rounded-md mt-6">
      <h2 className="text-2xl font-bold mb-4">Edit Product</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <input name="system_code" placeholder="System Code" value={formData.system_code} onChange={handleChange} className="p-2 border rounded" />
        <input name="supplier_code" placeholder="Supplier Code" value={formData.supplier_code} onChange={handleChange} className="p-2 border rounded" />
        <input name="product_name" placeholder="Product Name" value={formData.product_name} onChange={handleChange} className="p-2 border rounded" />
        <input name="product_category" placeholder="Product Category" value={formData.product_category} onChange={handleChange} className="p-2 border rounded" />

        <div className="col-span-2 flex items-center space-x-4">
          <label className="font-semibold">Returnable?</label>
          <label><input type="radio" name="returnable" value={true} checked={formData.returnable === true} onChange={() => setFormData(prev => ({ ...prev, returnable: true }))} /> Yes</label>
          <label><input type="radio" name="returnable" value={false} checked={formData.returnable === false} onChange={() => setFormData(prev => ({ ...prev, returnable: false }))} /> No</label>
        </div>

        <input name="purchase_price" placeholder="Purchase Price" type="number" value={formData.purchase_price} onChange={handleChange} className="p-2 border rounded" />
        <input name="selling_price" placeholder="Selling Price" type="number" value={formData.selling_price} onChange={handleChange} className="p-2 border rounded" />
        <input name="shell_price" placeholder="Shell Price" type="number" value={formData.shell_price} onChange={handleChange} className="p-2 border rounded" />
        <input name="bottle_price" placeholder="Bottle Price" type="number" value={formData.bottle_price} onChange={handleChange} className="p-2 border rounded" />
        <input name="content_no" placeholder="Content No" type="number" value={formData.content_no} onChange={handleChange} className="p-2 border rounded" />

        <select name="shell_type" value={formData.shell_type} onChange={handleChange} className="p-2 border rounded">
          <option value="">Select Shell Type</option>
          {shellTypes.map(st => (
            <option key={st.id} value={st.id}>{st.description}</option>
          ))}
        </select>

        <select name="content_type" value={formData.content_type} onChange={handleChange} className="p-2 border rounded">
          <option value="">Select Content Type</option>
          {contentTypes.map(ct => (
            <option key={ct.id} value={ct.id}>{ct.description}</option>
          ))}
        </select>

        <button type="submit" className="col-span-2 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 mt-4">Update Product</button>
      </form>
    </div>
  );
};

export default ProductEdit;
