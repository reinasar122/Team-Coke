import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { canCreate, canEdit, canDelete } from '../utils/accessControl';

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const warehouseId = getCurrentWarehouse();
      
      if (!warehouseId) {
        console.warn("No warehouse assigned to user");
        setProducts([]);
        return;
      }

      const res = await axios.get(`http://localhost:8080/api/products/?warehouse_id=${warehouseId}`);
      setProducts(res.data);
    } catch (err) {
      console.error("Error fetching products:", err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();

    // Listen for warehouse changes from Header component
    const handleWarehouseChange = () => {
      fetchProducts();
    };

    window.addEventListener('warehouseChanged', handleWarehouseChange);
    
    return () => {
      window.removeEventListener('warehouseChanged', handleWarehouseChange);
    };
  }, [fetchProducts]);

  const handleDelete = async (id) => {
    // Create custom confirm dialog
    const showConfirmDialog = (message, onConfirm) => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
          <p class="text-gray-700 dark:text-gray-300 mb-4">${message}</p>
          <div class="flex justify-end space-x-3">
            <button class="cancel-btn px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">Cancel</button>
            <button class="confirm-btn px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded">Delete</button>
          </div>
        </div>
      `;
      
      modal.querySelector('.cancel-btn').onclick = () => modal.remove();
      modal.querySelector('.confirm-btn').onclick = () => {
        modal.remove();
        onConfirm();
      };
      
      document.body.appendChild(modal);
    };

    showConfirmDialog("Are you sure you want to delete this product?", async () => {
      try {
        const warehouseId = getCurrentWarehouse();
        await axios.delete(`http://localhost:8080/api/products/${id}/?warehouse_id=${warehouseId}`);
        setProducts(prev => prev.filter(prod => prod.id !== id));
        
        // Show success message
        const showAlert = (message) => {
          const alertModal = document.createElement('div');
          alertModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
          alertModal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
              <p class="text-gray-700 dark:text-gray-300 mb-4">${message}</p>
              <div class="flex justify-end">
                <button class="ok-btn px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded">OK</button>
              </div>
            </div>
          `;
          alertModal.querySelector('.ok-btn').onclick = () => alertModal.remove();
          document.body.appendChild(alertModal);
        };
        
        showAlert("🗑️ Product deleted successfully!");
      } catch (err) {
        console.error(err);
        
        const showAlert = (message) => {
          const alertModal = document.createElement('div');
          alertModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
          alertModal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
              <p class="text-gray-700 dark:text-gray-300 mb-4">${message}</p>
              <div class="flex justify-end">
                <button class="ok-btn px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded">OK</button>
              </div>
            </div>
          `;
          alertModal.querySelector('.ok-btn').onclick = () => alertModal.remove();
          document.body.appendChild(alertModal);
        };
        
        showAlert("❌ Failed to delete product.");
      }
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600">Loading products...</span>
        </div>
      </div>
    );
  }

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

      {products.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No products found in your warehouse.</p>
        </div>
      ) : (
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
      )}
    </div>
  );
};

export default ProductList;