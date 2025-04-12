import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { FaEdit, FaTrash } from 'react-icons/fa'; // Font Awesome icons

const ProductList = () => {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    axios.get('http://localhost:8080/api/products/')
      .then(res => setProducts(res.data))
      .catch(err => console.error(err));
  }, []);


  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this product?");
    if (!confirmDelete) return;

    try {
      await axios.delete(`http://localhost:8080/api/products/${id}/`);
      setProducts(prev => prev.filter(prod => prod.id !== id));
      alert("🗑️ Product deleted successfully!");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to delete product.");
    }
  };


  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">PRODUCT LIST</h2>
        <Link
          to="/products/new"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Add Product
        </Link>
      </div>

      <table className="w-full bg-white rounded shadow">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">System Code</th>
            <th className="p-2">Supplier Code</th>
            <th className="p-2">Product Name</th>
            <th className="p-2">Category</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map(prod => (
            <tr key={prod.id} className="text-center border-t">
              <td className="p-2">{prod.system_code}</td>
              <td className="p-2">{prod.supplier_code}</td>
              <td className="p-2">{prod.product_name}</td>
              <td className="p-2">{prod.product_category}</td>
              <td className="p-2">
              <div className="flex justify-center gap-4">
                  <Link to={`/products/${prod.id}/edit`} title="Edit">
                    <FaEdit className="text-blue-600 hover:text-blue-800 cursor-pointer" />
                  </Link>
                  <button onClick={() => handleDelete(prod.id)} title="Delete">
                    <FaTrash className="text-red-600 hover:text-red-800 cursor-pointer" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProductList;
