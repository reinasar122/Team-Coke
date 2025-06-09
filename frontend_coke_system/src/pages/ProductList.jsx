import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { canCreate, canEdit, canDelete } from '../utils/accessControl';

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
          className={`px-4 py-2 rounded ${
            canCreate("Product")
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
          onClick={(e) => {
            if (!canCreate("Product")) e.preventDefault();
          }}
        >
          Add Product
        </Link>
      </div>

      <table className="w-full bg-white rounded shadow text-sm">
        <thead>
          <tr className="bg-gray-100 text-center">
            <th className="p-3">System Code</th>
            <th className="p-3">Supplier Code</th>
            <th className="p-3">Product Name</th>
            <th className="p-3">Category</th>
            <th className="p-3 w-32">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map(prod => (
            <tr key={prod.id} className="border-t text-center">
              <td className="p-3">{prod.system_code}</td>
              <td className="p-3">{prod.supplier_code}</td>
              <td className="p-3">{prod.product_name}</td>
              <td className="p-3">{prod.product_category?.name || "N/A"}</td>
              <td className="p-3">
                <div className="flex justify-center items-center gap-3">
                  {canEdit("Product") ? (
                    <Link to={`/products/${prod.id}/edit`} title="Edit">
                      <FaEdit className="text-blue-600 hover:text-blue-800 cursor-pointer" />
                    </Link>
                  ) : (
                    <FaEdit className="text-gray-400 cursor-not-allowed" title="No access" />
                  )}

                  {canDelete("Product") ? (
                    <button onClick={() => handleDelete(prod.id)} title="Delete">
                      <FaTrash className="text-red-600 hover:text-red-800 cursor-pointer" />
                    </button>
                  ) : (
                    <FaTrash className="text-gray-400 cursor-not-allowed" title="No access" />
                  )}
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
