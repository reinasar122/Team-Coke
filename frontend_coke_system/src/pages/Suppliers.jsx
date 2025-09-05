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
      s.street || s.barangay || s.city || s.province;

    if (!hasPSGC && s.street_address) {
      const parts = [
        s.street_address,
        s.barangay,
        s.city,
        s.province,
      ].filter(Boolean);
      return parts.join(", ");
    }

    const street = s.street ?? s.street_address; 

    const parts = [
      street,
      s.barangay,
      s.city,
      s.province,
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
          className="btn btn-add"
        >
          + New
        </button>
      </div>
      <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="border p-2">Registration Number</th>
                  <th className="border p-2">Company</th>
                  <th className="border p-2">Contact Person</th>
                  <th className="border p-2">Contact Number</th>
                  <th className="border p-2">Address</th>
                  <th className="border p-2">Actions</th>
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
                          className="icon-btn-edit"
                          onClick={() => setEditSupplierId(supplier.id)}
                        />
                        <FaTrash
                          className="icon-btn-danger"
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
      </div>
      

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
                className="btn btn-cancel"
                onClick={() => {
                    setShowDeleteModal(false);
                    setSupplierToDelete(null);
                }}
                >
                Cancel
                </button>
                <button
                className="btn btn-danger"
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