import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaTimes } from "react-icons/fa";
import api from "../api";
import "../styles/pages/mobiletransaction.scss";

const PromotionsPopup = ({ warehouseId, promotion, onClose, onSaved }) => {
  const dialogRef = useRef(null);
  const [promotionType, setPromotionType] = useState(promotion?.promotion_type || "");
  const [promotionValue, setPromotionValue] = useState(promotion?.discount_percent || "");
  const [selectedProducts, setSelectedProducts] = useState(
    promotion?.products?.map((product) => String(product.id)) || [],
  );
  const [allProducts, setAllProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [startDate, setStartDate] = useState(promotion?.start_date || "");
  const [endDate, setEndDate] = useState(promotion?.end_date || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const fetchProducts = async () => {
      setLoadingProducts(true);
      setSelectedProducts(promotion?.products?.map((product) => String(product.id)) || []);
      setError("");
      try {
        if (!warehouseId) throw new Error("Select a warehouse before adding a promotion.");
        const response = await api.get("products/", { params: { warehouse_id: warehouseId }, signal: controller.signal });
        const products = Array.isArray(response.data) ? response.data : response.data?.results || [];
        if (!controller.signal.aborted) setAllProducts(products);
      } catch (error) {
        if (!controller.signal.aborted) setError(error.response?.data?.detail || error.message || "Could not load products.");
      } finally {
        if (!controller.signal.aborted) setLoadingProducts(false);
      }
    };
    fetchProducts();
    return () => controller.abort();
  }, [warehouseId, promotion]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError("");
    setMessage("");
    if (!warehouseId || selectedProducts.length === 0) {
      setError("Select at least one product for this promotion.");
      return;
    }
    if (endDate < startDate) {
      setError("End date must be on or after start date.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        promotion_type: promotionType,
        discount_percent: promotionType === "occasional-discount" ? promotionValue : "0",
        product_ids: selectedProducts.map(Number), start_date: startDate, end_date: endDate,
      };
      const response = promotion
        ? await api.patch(`promotions/${promotion.id}/`, payload, { params: { warehouse: warehouseId } })
        : await api.post("promotions/", payload, { params: { warehouse: warehouseId } });
      onSaved?.(response.data);
      setMessage(promotion
        ? "Promotion updated."
        : response.data.status === "Active"
          ? "Promotion saved. It is now available on the mobile home page."
          : "Promotion saved. It will appear on the mobile home page during its scheduled dates.");
      setSelectedProducts([]);
      setPromotionType("");
      setPromotionValue("");
      setStartDate("");
      setEndDate("");
    } catch (failure) {
      const data = failure.response?.data;
      setError(typeof data?.detail === "string" ? data.detail : data && typeof data === "object"
        ? Object.values(data).flat().join(" ") : "Could not save the promotion. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      className="mobile-order-dialog promotions-popup"
      aria-labelledby="promotions-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
      onClick={(event) => {
        if (!saving && event.target === dialogRef.current) onClose();
      }}
    >
      <div className="mobile-order-dialog__content">
        <header>
          <div>
            <h2 id="promotions-title">{promotion ? "Edit Promotion" : "Add Promotion"}</h2>
          </div>
          <button
            type="button"
            className="mobile-order-dialog__close"
            aria-label="Close promotions"
            onClick={onClose}
            disabled={saving}
            autoFocus
          >
            <FaTimes />
          </button>
        </header>
        <form onSubmit={handleSubmit} className="promotions-popup__form">
          <div className="promotions-popup__field">
            <label htmlFor="promotion-type">Promotion Type</label>
            <select
              id="promotion-type"
              value={promotionType}
              onChange={(e) => setPromotionType(e.target.value)}
              required
              disabled={saving}
            >
              <option value="">Select Promotion Type</option>
              <option value="buy-one-take-one">Buy One Take One</option>
              <option value="occasional-discount">Occasional Discount</option>
              <option value="free-shipping">Free Shipping</option>
            </select>
          </div>

          {promotionType === "occasional-discount" && (
            <div className="promotions-popup__field">
              <label htmlFor="promotion-value">Discount (%)</label>
              <input
                id="promotion-value"
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                required
                disabled={saving}
                value={promotionValue}
                onChange={(e) => setPromotionValue(e.target.value)}
                placeholder="e.g., 10"
              />
            </div>
          )}

          <div className="promotions-popup__field">
            <label id="promotion-products-label">Applicable Products</label>
            <div className="promotions-popup__products" role="region" aria-labelledby="promotion-products-label" tabIndex={0} aria-busy={loadingProducts}>
              {loadingProducts ? (
                <p role="status">Loading products...</p>
              ) : allProducts.length === 0 ? (
                <p>No products available.</p>
              ) : (
                allProducts.map((product) => (
                  <label key={product.id} className="promotions-popup__product">
                    <input
                      type="checkbox"
                      disabled={saving}
                      checked={selectedProducts.includes(String(product.id)) || selectedProducts.includes(product.id)}
                      onChange={(e) => {
                        const productId = String(product.id);
                        if (e.target.checked) {
                          setSelectedProducts((prev) => [...prev, productId]);
                        } else {
                          setSelectedProducts((prev) => prev.filter((id) => id !== productId));
                        }
                      }}
                    />
                    <span>{product.product_name || product.name || `Product #${product.id}`}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="promotions-popup__dates">
            <div className="promotions-popup__field">
              <label htmlFor="start-date">Start Date</label>
              <input
                id="start-date"
                type="date"
                required
                disabled={saving}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="promotions-popup__field">
              <label htmlFor="end-date">End Date</label>
              <input
                id="end-date"
                type="date"
                required
                min={startDate || undefined}
                disabled={saving}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {message && <p role="status" className="mobile-purchases__success">{message}</p>}
          {error && <p role="alert" className="mobile-purchases__feedback">{error}</p>}

          <button type="submit" className="mobile-purchases__primary mobile-order-dialog__confirm" disabled={saving || loadingProducts || !warehouseId || allProducts.length === 0}>
            {saving ? "Saving…" : promotion ? "Save Changes" : "Save Promotion"}
          </button>
          <button type="button" className="mobile-purchases__primary mobile-order-dialog__done" onClick={onClose} disabled={saving}>
            Cancel
          </button>
        </form>
      </div>
    </dialog>,
    document.body
  );
};

export default PromotionsPopup;
