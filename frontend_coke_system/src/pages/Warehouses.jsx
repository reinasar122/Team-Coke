import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { errorStyle } from "../utils/toastStyles";
import {
  FaWarehouse,
  FaEdit,
  FaTrash,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
} from "react-icons/fa";
import {
  canCreate,
  canEdit,
  canDelete,
  canView,
} from "../utils/accessControl";
import WarehouseForm from "./WarehouseForm";
import EditWarehouse from "./EditWarehouse";
import api from "../api";
import "../styles/pages/warehouses.scss";

const formatWarehouseAddress = (warehouse) =>
  [
    warehouse.street_address,
    warehouse.barangay,
    warehouse.city,
    warehouse.province,
    warehouse.region,
    warehouse.country,
    warehouse.zip_code,
  ]
    .filter(Boolean)
    .join(", ");

const Warehouses = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editWarehouseId, setEditWarehouseId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [warehouseToDelete, setWarehouseToDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    const hasOpenModal = showCreateModal || !!editWarehouseId || showDeleteModal;
    if (!hasOpenModal) return undefined;

    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;

      if (showDeleteModal) {
        setShowDeleteModal(false);
        setWarehouseToDelete(null);
        return;
      }

      if (editWarehouseId) {
        setEditWarehouseId(null);
        return;
      }

      if (showCreateModal) {
        setShowCreateModal(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showCreateModal, editWarehouseId, showDeleteModal]);

  const fetchWarehouses = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.get("/warehouses/");
      setWarehouses(data);
    } catch (err) {
      console.error("Error fetching warehouses:", err);
      setError(err.message || "Failed to load warehouses.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/warehouses/${warehouseToDelete.id}/`);
      setWarehouses((prev) => prev.filter((w) => w.id !== warehouseToDelete.id));
      toast.error(`Warehouse '${warehouseToDelete.name}' has been deleted.`, {
        style: errorStyle,
      });
    } catch (err) {
      console.error("Error deleting warehouse:", err);
      toast.error("Failed to delete warehouse.", { style: errorStyle });
    } finally {
      setShowDeleteModal(false);
      setWarehouseToDelete(null);
    }
  };

  if (!canView("Warehouse")) {
    return (
      <div className="p-6 font-semibold text-red-500">
        You do not have permission to view warehouses.
      </div>
    );
  }

  return (
    <div className="page warehouses-page">
      <div className="page-header warehouses-page__header">
        <h2 className="page-title warehouses-page__title">
          <FaWarehouse className="warehouses-page__title-icon" aria-hidden="true" />
          <span>Warehouses</span>
        </h2>

        <button
          className="btn btn-add app-page-create-btn warehouses-page__new-btn"
          onClick={() => canCreate("Warehouse") && setShowCreateModal(true)}
          disabled={!canCreate("Warehouse")}
        >
          + New Warehouse
        </button>
      </div>

      <div className="warehouses-page__content">
        {loading ? (
          <div className="warehouses-page__state warehouses-page__state--loading">
            <svg
              className="h-8 w-8 animate-spin text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              ></path>
            </svg>
            <span>Loading warehouses...</span>
          </div>
        ) : error ? (
          <div className="warehouses-page__state warehouses-page__state--error">
            {error}
          </div>
        ) : warehouses.length === 0 ? (
          <div className="warehouses-page__state">
            No warehouses found. Click <span className="font-bold">+ New Warehouse</span> to add one.
          </div>
        ) : (
          <div className="warehouses-page__grid">
            {warehouses.map((warehouse) => (
              <article key={warehouse.id} className="warehouses-page__card">
                <div className="warehouses-page__card-header">
                  <span className="warehouses-page__card-icon" aria-hidden="true">
                    <FaWarehouse />
                  </span>
                  <h3 className="warehouses-page__card-title">{warehouse.name}</h3>
                </div>

                <div className="warehouses-page__details">
                  <p className="warehouses-page__detail warehouses-page__detail--address">
                    <FaMapMarkerAlt
                      className="warehouses-page__detail-icon warehouses-page__detail-icon--address"
                      aria-hidden="true"
                    />
                    <span>{formatWarehouseAddress(warehouse)}</span>
                  </p>

                  <p className="warehouses-page__detail">
                    <FaPhone
                      className="warehouses-page__detail-icon warehouses-page__detail-icon--phone"
                      aria-hidden="true"
                    />
                    <span>{warehouse.phone_number || "No phone number listed"}</span>
                  </p>

                  <p className="warehouses-page__detail">
                    <FaEnvelope
                      className="warehouses-page__detail-icon warehouses-page__detail-icon--email"
                      aria-hidden="true"
                    />
                    <span>{warehouse.email || "No email listed"}</span>
                  </p>
                </div>

                <div className="warehouses-page__actions">
                  <button
                    onClick={() => canEdit("Warehouse") && setEditWarehouseId(warehouse.id)}
                    disabled={!canEdit("Warehouse")}
                    title="Edit Warehouse"
                    aria-label={`Edit ${warehouse.name}`}
                    className="icon-btn"
                  >
                    <FaEdit />
                  </button>

                  <button
                    onClick={() => {
                      if (canDelete("Warehouse")) {
                        setWarehouseToDelete(warehouse);
                        setShowDeleteModal(true);
                      }
                    }}
                    disabled={!canDelete("Warehouse")}
                    title="Delete Warehouse"
                    aria-label={`Delete ${warehouse.name}`}
                    className="icon-btn-danger"
                  >
                    <FaTrash />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="app-modal-overlay z-50" role="dialog" aria-modal="true">
          <div className="app-modal-panel app-modal-panel-md w-full max-w-lg rounded bg-white p-6 shadow-lg">
            <WarehouseForm
              onClose={() => setShowCreateModal(false)}
              onSuccess={() => {
                fetchWarehouses();
                setShowCreateModal(false);
              }}
            />
          </div>
        </div>
      )}

      {editWarehouseId && (
        <div className="app-modal-overlay z-50" role="dialog" aria-modal="true">
          <div className="app-modal-panel app-modal-panel-md w-full max-w-lg rounded bg-white p-6 shadow-lg">
            <EditWarehouse
              id={editWarehouseId}
              onClose={() => setEditWarehouseId(null)}
              onSuccess={() => {
                fetchWarehouses();
                setEditWarehouseId(null);
              }}
            />
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="app-modal-overlay z-50" role="dialog" aria-modal="true">
          <div className="app-modal-panel app-modal-panel-sm mx-4 w-full max-w-xl rounded bg-white p-6 shadow-lg">
            <p className="mb-6 text-lg font-semibold">
              Are you sure you want to delete <strong>{warehouseToDelete?.name}</strong>?
            </p>

            <div className="mt-4 flex justify-end gap-2 md:col-span-2">
              <div>
                <button
                  className="btn btn-cancel px-4 py-2"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
              </div>
              <div>
                <button
                  className="btn btn-danger px-4 py-2"
                  onClick={handleDelete}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Warehouses;
