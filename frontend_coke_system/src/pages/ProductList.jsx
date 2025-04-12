import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const ProductList = () => {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    axios.get('/products/')
      .then(res => setProducts(res.data))
      .catch(err => console.error(err));
  }, []);

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
            <th className="p-2">Product Name</th>
            <th className="p-2">Category</th>
            <th className="p-2">Supplier Code</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map(prod => (
            <tr key={prod.id} className="text-center border-t">
              <td className="p-2">{prod.system_code}</td>
              <td className="p-2">{prod.product_name}</td>
              <td className="p-2">{prod.product_category}</td>
              <td className="p-2">{prod.supplier_code}</td>
              <td className="p-2">
                <Link
                  to={`/products/${prod.id}/edit`}
                  className="text-blue-500 hover:underline"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProductList;
