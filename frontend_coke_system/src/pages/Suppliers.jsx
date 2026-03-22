import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  findWarehouseByName,
  getCurrentWarehouse,
  getWarehouseAxiosConfig,
} from "../utils/warehouseUtils";
import {
  FaTrash,
  FaEdit,
  FaPhoneAlt,
  FaEnvelope,
  FaIdCard,
  FaTimes,
  FaSearch,
  FaBuilding,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { errorStyle } from "../utils/toastStyles";
import SupplierRegistrationForm from "./SupplierRegistrationForm";
import SupplierEditForm from "./SupplierEditForm";
import { canView, canCreate, canEdit, canDelete } from "../utils/accessControl";
import api from "../api"; // ✅ correct

//const API = "http://localhost:8080/api";

/* tiny helper for key:value rows */
function Detail({ label, value, className = "" }) {
  return (
    <div className={className}>
      <span className="text-gray-500">{label}</span>{" "}
      <span className="text-gray-800 font-medium break-words">{value}</span>
    </div>
  );
}

const normalizeSupplierList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const upsertSupplier = (items, supplier) => {
  if (!supplier?.id) return items;
  return [supplier, ...items.filter((item) => item.id !== supplier.id)];
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);

  const supplierCanView = canView("Supplier");
  const supplierCanCreate = canCreate("Supplier");
  const supplierCanEdit = canEdit("Supplier");
  const supplierCanDelete = canDelete("Supplier");

  // View mode: 'grid' | 'list'
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem("supplier_view_mode") || "list"
  );

  // Company name search
  const [searchTerm, setSearchTerm] = useState("");

  // Sort by date added
  const [sortOrder, setSortOrder] = useState(
    () => localStorage.getItem("supplier_sort_order") || "desc" // desc = newest first
  );

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editSupplierId, setEditSupplierId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState(null);

  useEffect(() => {
    localStorage.setItem("supplier_view_mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem("supplier_sort_order", sortOrder);
  }, [sortOrder]);

  useEffect(() => {
    const hasOpenModal = showRegisterModal || !!editSupplierId || showDeleteModal;
    if (!hasOpenModal) return undefined;

    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;

      if (showDeleteModal) {
        setShowDeleteModal(false);
        setSupplierToDelete(null);
        return;
      }
      if (editSupplierId) {
        setEditSupplierId(null);
        return;
      }
      if (showRegisterModal) {
        setShowRegisterModal(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showRegisterModal, editSupplierId, showDeleteModal]);

  const fetchSuppliers = useCallback(
    async ({ showErrorToast = true, attempts = 1, delayMs = 0 } = {}) => {
      setLoading(true);

      try {
        let lastError;

        for (let attempt = 0; attempt < attempts; attempt += 1) {
          try {
            let warehouse = getCurrentWarehouse();
            if (warehouse?.needsIdLookup && warehouse.name) {
              warehouse = await findWarehouseByName(warehouse.name);
            }

            const warehouseConfig = getWarehouseAxiosConfig(warehouse);
            const requests = warehouse?.id
              ? [
                  { url: `/suppliers/?warehouse=${warehouse.id}`, config: warehouseConfig },
                  { url: `/suppliers/?warehouse_id=${warehouse.id}`, config: warehouseConfig },
                  { url: "/suppliers/", config: warehouseConfig },
                  { url: "/suppliers/" },
                ]
              : [{ url: "/suppliers/" }];

            let response;
            for (const request of requests) {
              try {
                response = await api.get(request.url, request.config);
                break;
              } catch (requestError) {
                lastError = requestError;
              }
            }

            if (!response) {
              throw lastError || new Error("Failed to load suppliers.");
            }

            setSuppliers(normalizeSupplierList(response.data));
            return;
          } catch (attemptError) {
            lastError = attemptError;
            if (attempt < attempts - 1 && delayMs > 0) {
              await wait(delayMs);
            }
          }
        }

        throw lastError || new Error("Failed to load suppliers.");
      } catch (error) {
        console.error("Error fetching suppliers:", error);
        if (showErrorToast) {
          toast.error("Failed to load suppliers.", { style: errorStyle });
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchSuppliers();
  }, [fetchSuppliers]);

  const formatAddress = (s) => {
    const street = s.street ?? s.street_address;
    const parts = [street, s.barangay, s.city, s.province, s.zip_code]
      .filter(Boolean)
      .join(", ");
    return parts;
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/suppliers/${supplierToDelete.id}/`);
      setSuppliers((prev) => prev.filter((x) => x.id !== supplierToDelete.id));
      toast.error(
        `Supplier ${supplierToDelete.company_name} has been deleted.`,
        { style: errorStyle }
      );
    } catch (error) {
      console.error("Error deleting supplier:", error);

      if (error.response?.status === 400 && error.response.data?.detail) {
        toast.error(error.response.data.detail, { style: errorStyle });
      } else {
        toast.error("Failed to delete supplier.", { style: errorStyle });
      }
    } finally {
      setShowDeleteModal(false);
      setSupplierToDelete(null);
    }
  };

  const EmptyState = ({ message = "No suppliers yet. Click + New to add one." }) => (
    <div className="w-full text-center py-16 border border-dashed rounded-xl text-gray-500">
      {message}
    </div>
  );

  // normalize any supported "date added" field to a numeric timestamp
  const getDateValue = (s) => {
    const raw =
      s?.date_added ||
      s?.created_at ||
      s?.created ||
      s?.added_at ||
      null;
    if (!raw) {
      // fallback: use id as a weak proxy so sorting is stable
      return Number(s?.id) || 0;
    }
    // accept ISO string or epoch
    if (typeof raw === "number") return raw;
    const t = Date.parse(raw);
    return Number.isNaN(t) ? 0 : t;
  };

  // Filter by company name (case-insensitive)
  const filteredSuppliers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => (s.company_name || "").toLowerCase().includes(q));
  }, [suppliers, searchTerm]);

  // Sort by date added
  const sortedSuppliers = useMemo(() => {
    const arr = [...filteredSuppliers];
    arr.sort((a, b) => {
      const da = getDateValue(a);
      const db = getDateValue(b);
      return sortOrder === "asc" ? da - db : db - da; // asc = oldest first, desc = newest first
    });
    return arr;
  }, [filteredSuppliers, sortOrder]);

  /* ----------------------------- GRID (cards - FULL) ----------------------------- */
  const CardFull = ({ s }) => {
    return (
      <div className="rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">
        {/* Header (summary) */}
        <div className="p-4">
          {/* Company name — allow 2 lines, show ellipsis */}
          <h3
            className="text-lg font-semibold leading-tight break-words"
            title={s.company_name}
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {s.company_name}
          </h3>

          <div className="mt-1 text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-2">
              <FaIdCard className="opacity-70" />
              {s.registration_number || "—"}
            </span>
            {s.phone_number && (
              <span className="inline-flex items-center gap-2">
                <FaPhoneAlt className="opacity-70" />
                {s.phone_number}
              </span>
            )}
            {s.email && (
              <span className="inline-flex items-center gap-2">
                <FaEnvelope className="opacity-70" />
                {s.email}
              </span>
            )}
          </div>

          {s.contact_person && (
            <div className="mt-2 text-sm">
              <span className="font-medium">Contact Person:</span>{" "}
              <span className="text-gray-700 break-words">{s.contact_person}</span>
            </div>
          )}
        </div>

        {/* Body (full details always visible) */}
        <div className="px-4 pt-0 pb-2 text-sm">
          <Detail label="BIR No.:" value={s.bir_no || "—"} />
          <Detail className="mt-1.5" label="Full Address:" value={formatAddress(s) || "—"} />

          {/* Additional Contacts */}
          {Array.isArray(s.contacts) && s.contacts.length > 0 && (
            <div className="mt-3">
              <p className="font-semibold mb-1.5">Additional Contacts</p>
              <ul className="space-y-1.5">
                {s.contacts.map((c, idx) => (
                  <li
                    key={`${c.email || "contact"}-${idx}`}
                    className="rounded-lg border p-2 flex flex-wrap gap-x-3 gap-y-1 text-sm"
                  >
                    <span className="font-medium break-words">
                      {c.contact_person || "—"}
                    </span>
                    {c.email && <span className="text-gray-600 break-words">{c.email}</span>}
                    {c.phone_number && (
                      <span className="text-gray-600 break-words">{c.phone_number}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer actions (bottom-right, compact padding) */}
        <div className="px-4 pb-3 pt-2 flex justify-end gap-2">
          <button
            type="button"
            title={supplierCanEdit ? "Edit" : "No permission to edit suppliers"}
            className={`rounded-md p-2 ${
              supplierCanEdit ? "icon-btn-edit hover:bg-gray-100" : "icon-btn-disabled"
            }`}
            onClick={() => {
              if (supplierCanEdit) setEditSupplierId(s.id);
            }}
            disabled={!supplierCanEdit}
          >
            <FaEdit />
          </button>
          <button
            type="button"
            title={
              !supplierCanDelete
                ? "No permission to delete suppliers"
                : s.can_delete
                ? "Delete"
                : "Cannot delete (has transactions)"
            }
            className={`icon-btn-danger hover:bg-red-50 rounded-md p-2 ${
              !supplierCanDelete || !s.can_delete ? "opacity-50 cursor-not-allowed" : ""
            }`}
            disabled={!supplierCanDelete || !s.can_delete}
            onClick={() => {
              if (supplierCanDelete && s.can_delete) {
                setSupplierToDelete(s);
                setShowDeleteModal(true);
              }
            }}
          >
            <FaTrash />
          </button>
        </div>
      </div>
    );
  };

  /* ------------------------------ LIST (table) ----------------------------- */
  const ListView = () => (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th className="border p-2 text-center">Registration #</th>
            <th className="border p-2 text-center">Company</th>
            <th className="border p-2 text-center">Contact Person</th>
            <th className="border p-2 text-center">Phone</th>
            <th className="border p-2 text-center">Email</th>
            <th className="border p-2 text-center">Full Address</th>
            <th className="border p-2 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedSuppliers.map((s) => (
            <tr key={s.id} className="border align-top">
              <td className="border p-2">{s.registration_number}</td>
              <td className="border p-2 break-words">{s.company_name}</td>
              <td className="border p-2 break-words">{s.contact_person}</td>
              <td className="border p-2 break-words">{s.phone_number}</td>
              <td className="border p-2 break-words">{s.email}</td>
              <td className="border p-2 break-words">{formatAddress(s)}</td>
              <td className="border p-2">
                <div className="flex justify-center gap-2">
                  <button
                    className={`rounded-md p-2 ${
                      supplierCanEdit ? "icon-btn-edit hover:bg-gray-100" : "icon-btn-disabled"
                    }`}
                    onClick={() => {
                      if (supplierCanEdit) setEditSupplierId(s.id);
                    }}
                    title={supplierCanEdit ? "Edit" : "No permission to edit suppliers"}
                    type="button"
                    disabled={!supplierCanEdit}
                  >
                    <FaEdit />
                  </button>
                  <button
                    type="button"
                    title={
                      !supplierCanDelete
                        ? "No permission to delete suppliers"
                        : s.can_delete
                        ? "Delete"
                        : "Cannot delete (has transactions)"
                    }
                    className={`icon-btn-danger hover:bg-red-50 rounded-md p-2 ${
                      !supplierCanDelete || !s.can_delete ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    disabled={!supplierCanDelete || !s.can_delete}
                    onClick={() => {
                      if (supplierCanDelete && s.can_delete) {
                        setSupplierToDelete(s);
                        setShowDeleteModal(true);
                      }
                    }}
                  >
                    <FaTrash />
                  </button>
                </div>
              </td>
            </tr>
          ))}

          {sortedSuppliers.length === 0 && (
            <tr>
              <td colSpan={7} className="p-6">
                <EmptyState message="No suppliers match your search." />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const GridView = () => (
    <div
      className="grid auto-rows-auto grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
      style={{ gridAutoFlow: "row dense" }}
    >
      {loading ? (
        Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border bg-white shadow-sm p-4 animate-pulse h-40"
          >
            <div className="h-5 w-1/2 bg-gray-200 rounded mb-3" />
            <div className="h-4 w-1/3 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-1/4 bg-gray-200 rounded" />
          </div>
        ))
      ) : sortedSuppliers.length === 0 ? (
        <div className="md:col-span-2 xl:col-span-3">
          <EmptyState message="No suppliers match your search." />
        </div>
      ) : (
        sortedSuppliers.map((s) => <CardFull key={s.id} s={s} />)
      )}
    </div>
  );

  return (
    <div className="page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FaBuilding className="text-gray-700" /> Suppliers
          </h2>

          {/* Company Name Search with icon */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search company name…"
              className="border rounded-lg pl-9 pr-8 py-2 w-64"
            />
            {searchTerm && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                onClick={() => setSearchTerm("")}
                title="Clear"
              >
                <FaTimes />
              </button>
            )}
          </div>

          {/* View dropdown */}
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option value="grid">Grid View</option>
            <option value="list">List View</option>
          </select>

          {/* Sort by date added */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="border rounded-lg px-3 py-2"
            title="Sort by date added"
          >
            <option value="desc">Sort: Newest</option>
            <option value="asc">Sort: Oldest</option>
          </select>
        </div>

        <button
          onClick={() => {
            if (supplierCanCreate) setShowRegisterModal(true);
          }}
          className={`btn ${supplierCanCreate ? "btn-add" : "btn-disabled"}`}
          disabled={!supplierCanCreate}
          title={supplierCanCreate ? "Add Supplier" : "No permission to add suppliers"}
        >
          + Add Supplier
        </button>
      </div>

      {/* Content */}
      {!supplierCanView ? (
        <div className="w-full text-center py-16 border border-dashed rounded-xl text-gray-500">
          You do not have permission to view Suppliers.
        </div>
      ) : viewMode === "grid" ? (
        <GridView />
      ) : (
        <ListView />
      )}

      {/* Registration Modal */}
      {showRegisterModal && (
        <div className="app-modal-overlay z-50" role="dialog" aria-modal="true">
          <div className="app-modal-panel app-modal-panel-2xl bg-white p-6 rounded-2xl shadow-lg w-11/12 md:w-3/4 max-h-[90vh] overflow-auto">
            <SupplierRegistrationForm
              onClose={() => {
                setShowRegisterModal(false);
              }}
              onSuccess={(createdSupplier) => {
                if (createdSupplier) {
                  setSuppliers((prev) => upsertSupplier(prev, createdSupplier));
                }
                void fetchSuppliers({ showErrorToast: false, attempts: 3, delayMs: 300 });
              }}
            />
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editSupplierId && (
        <div className="app-modal-overlay z-50" role="dialog" aria-modal="true">
          <div className="app-modal-panel app-modal-panel-2xl bg-white p-6 rounded-2xl shadow-lg w-11/12 md:w-3/4 max-h-[90vh] overflow-auto">
            <SupplierEditForm
              supplierId={editSupplierId}
              onClose={() => {
                setEditSupplierId(null);
                void fetchSuppliers();
              }}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && supplierToDelete && (
        <div className="app-modal-overlay z-50 px-4" role="dialog" aria-modal="true">
          <div className="app-modal-panel app-modal-panel-sm bg-white p-6 rounded-2xl shadow-lg max-w-full w-[520px]">
            <p className="text-lg font-semibold mb-6">
              Are you sure you want to delete{" "}
              <strong>{supplierToDelete.company_name}</strong>?
            </p>
            <div className="md:col-span-2 flex justify-end gap-2 mt-4">
              <button
                className="btn btn-cancel"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSupplierToDelete(null);
                }}
              >
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
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
