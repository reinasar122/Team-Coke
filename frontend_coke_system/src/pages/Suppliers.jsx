import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaTrash, FaEdit } from "react-icons/fa";
import { toast } from "react-toastify";
import {errorStyle } from "../utils/toastStyles";
import SupplierRegistrationForm from "./SupplierRegistrationForm";
import SupplierEditForm from "./SupplierEditForm";

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editSupplierId, setEditSupplierId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState(null);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get("http://localhost:8080/api/suppliers/");
      setSuppliers(response.data);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  const formatAddress = (s) => {
    const hasPSGC =
      s.street || s.barangay || s.city || s.province || s.region || s.zip_code || s.country;

    if (!hasPSGC && s.street_address) {
      const parts = [
        s.street_address,
        s.barangay,
        s.city,
        s.province,
        s.region,
        s.country,
        s.zip_code ? `(${s.zip_code})` : null,
      ].filter(Boolean);
      return parts.join(", ");
    }

    const street = s.street ?? s.street_address; 
    const country = s.country || "Philippines";

    const parts = [
      street,
      s.barangay,
      s.city,
      s.province,
      s.region,
      country,
      s.zip_code ? `(${s.zip_code})` : null,
    ].filter(Boolean);

    return parts.join(", ");
  };

  const handleDelete = async () => {
  try {
    await axios.delete(`http://localhost:8080/api/suppliers/${supplierToDelete.id}/`);
    setSuppliers((prev) => prev.filter((s) => s.id !== supplierToDelete.id));

    toast.error(`Supplier ${supplierToDelete.company_name} has been deleted.`, {
      style: errorStyle,
    });
  } catch (error) {
    console.error("Error deleting supplier:", error);
    toast.error("Failed to delete supplier.", {
      style: errorStyle,
    });
  } finally {
    setShowDeleteModal(false);
    setSupplierToDelete(null);
  }
  };

  return (
    <div className="container mx-auto p-6 relative">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Supplier Registration Details</h2>
        <button
          onClick={() => setShowRegisterModal(true)}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
        >
          + New
        </button>
      </div>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">REGISTRATION NUMBER</th>
            <th className="border p-2">COMPANY NAME</th>
            <th className="border p-2">CONTACT PERSON</th>
            <th className="border p-2">CONTACT NUMBER</th>
            <th className="border p-2">ADDRESS</th>
            <th className="border p-2">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="text-center">
          {suppliers.map((supplier) => (
            <tr key={supplier.id} className="border">
              <td className="border p-2">{supplier.registration_number}</td>
              <td className="border p-2">{supplier.company_name}</td>
              <td className="border p-2">{supplier.contact_person}</td>
              <td className="border p-2">{supplier.phone_number}</td>
              <td className="border p-2">
                {/* Full formatted address */}
                {formatAddress(supplier)}
              </td>
              <td className="border p-2">
                <div className="flex justify-center gap-3">
                  <FaEdit
                    size={20}
                    className="text-blue-500 cursor-pointer"
                    onClick={() => setEditSupplierId(supplier.id)}
                  />
                  <FaTrash
                    size={20}
                    className="text-red-500 cursor-pointer"
                    onClick={() => {
                      setSupplierToDelete(supplier);
                      setShowDeleteModal(true);
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded shadow-lg w-3/4 max-h-[90vh] overflow-auto">
            <SupplierRegistrationForm
              onClose={() => {
                setShowRegisterModal(false);
                fetchSuppliers();
              }}
            />
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editSupplierId && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded shadow-lg w-3/4 max-h-[90vh] overflow-auto">
            <SupplierEditForm
              supplierId={editSupplierId}
              onClose={() => {
                setEditSupplierId(null);
                fetchSuppliers();
              }}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && supplierToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 px-4">
          <div className="bg-white p-6 rounded shadow-lg max-w-full w-auto max-h-[90vh] overflow-auto">
            <p className="text-lg font-semibold mb-6">
                Are you sure you want to delete <strong>{supplierToDelete.company_name}</strong>?
            </p>
            <div className="flex justify-between">
                <button
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                onClick={() => {
                    setShowDeleteModal(false);
                    setSupplierToDelete(null);
                }}
                >
                Cancel
                </button>
                <button
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                onClick={handleDelete}
                >
                Delete
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;