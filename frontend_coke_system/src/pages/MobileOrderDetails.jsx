import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaUserAlt, FaMapMarkerAlt, FaRegClock, FaWineBottle, FaTimes, FaTruck, FaCheck } from "react-icons/fa";
import api from "../api";
import { deliveryError } from "../hooks/useMobileDeliveries";
import { toPurchaseCard } from "../utils/mobileOrders";
import "../styles/pages/mobiletransaction.scss";

const formatAmount = (amount) =>
  new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

const orderNumber = (order) => order.number || order.id;

const ProductPreview = ({ item }) => {
  const product = item;
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [product.image]);

  return (
    <div className="mobile-purchases__product">
      <span className="mobile-purchases__thumbnail" aria-hidden="true">
        {product.image && !imageFailed ? (
          <img src={product.image} alt="" onError={() => setImageFailed(true)} />
        ) : (
          <FaWineBottle style={{ color: product.color || "#64748b" }} />
        )}
      </span>
      <span>{product.name} <span className="mobile-purchases__quantity">x {item.quantity}</span></span>
    </div>
  );
};

const MobileOrderDetails = ({ order, warehouseId, onClose, onConfirm }) => {
  const dialogRef = useRef(null);
  const [details, setDetails] = useState(order);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");

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
    api.get(`mobile-orders/${encodeURIComponent(order.id)}/`, {
      params: { warehouse: warehouseId }, signal: controller.signal,
    }).then(({ data }) => {
      if (!controller.signal.aborted) setDetails(toPurchaseCard(data));
    }).catch((failure) => {
      if (!controller.signal.aborted) setError(failure?.response?.data?.detail || "Could not refresh this order. Showing the last loaded details.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [order.id, warehouseId]);

  const confirmOrder = async () => {
    if (loading || error || confirming || !["NEW", "PENDING"].includes(details.rawStatus)) return;
    setConfirming(true);
    setConfirmationError("");
    try {
      await onConfirm(details);
    } catch (failure) {
      setConfirmationError(failure?.message && !failure.response ? failure.message : deliveryError(failure));
    } finally {
      setConfirming(false);
    }
  };

  return createPortal(
    <dialog ref={dialogRef} className="mobile-order-dialog" aria-labelledby="mobile-order-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === dialogRef.current) onClose(); }}>
      <div className="mobile-order-dialog__content">
        <header>
          <div><p><strong>Order details</strong></p><h2 id="mobile-order-title">{orderNumber(details)}</h2></div>
          <button type="button" className="mobile-order-dialog__close" aria-label="Close order details" onClick={onClose} autoFocus><FaTimes /></button>
        </header>
        {loading && <p role="status" className="mobile-order-dialog__notice">Refreshing order details…</p>}
        {error && <p role="alert" className="mobile-order-dialog__notice">{error}</p>}
        <span className={`mobile-purchases__status mobile-purchases__status--${details.statusClass}`}>{details.status}</span>
        {details.isTest && <span className="mobile-purchases__test-label">Test order</span>}
        <dl className="mobile-order-dialog__info">
          <div><dt><FaUserAlt /> Customer</dt><dd>{details.customer}</dd></div>
          <div><dt><FaMapMarkerAlt /> Delivery address</dt><dd>{details.address}</dd></div>
          <div><dt><FaRegClock /> Ordered on</dt><dd>{details.dateLabel}</dd></div>
          {details.deliveryId && <div><dt><FaTruck /> Grouped delivery</dt><dd>{details.deliveryAddress}</dd></div>}
        </dl>
        <div className="mobile-order-dialog__items-heading"><h3>Products ({details.products.length})</h3><span>Subtotal</span></div>
        <ul className="mobile-order-dialog__items">
          {details.products.map((item, index) => {
            const hasPrice = item.unitPrice != null && item.unitPrice !== "" && Number.isFinite(Number(item.unitPrice));
            const hasTotal = item.lineTotal != null && item.lineTotal !== "" && Number.isFinite(Number(item.lineTotal));
            return <li key={item.id || index}>
              <div className="mobile-order-dialog__item-details">
                <ProductPreview item={item} />
                <div className="mobile-order-dialog__computation">
                  <span>{item.quantity} {Number(item.quantity) === 1 ? "piece" : "pieces"}{hasPrice && <> × ₱ {formatAmount(item.unitPrice)}</>}</span>
                  {Number(item.discountPercent) > 0 && <span>Less {Number(item.discountPercent)}% discount</span>}
                  {(!hasPrice || !hasTotal) && <span>Price breakdown unavailable</span>}
                </div>
              </div>
              <strong className="mobile-order-dialog__subtotal">{hasTotal ? `₱ ${formatAmount(item.lineTotal)}` : "—"}</strong>
            </li>;
          })}
        </ul>
        {details.products.length === 0 && <p>No product details available.</p>}
        <footer><span>Order total</span><strong>₱ {formatAmount(details.total)}</strong></footer>
        {confirmationError && <p role="alert" className="mobile-purchases__feedback">{confirmationError}</p>}
        {["NEW", "PENDING"].includes(details.rawStatus) && <button type="button" className="mobile-purchases__primary mobile-order-dialog__confirm" disabled={loading || Boolean(error) || confirming || details.isTest} onClick={confirmOrder}><FaCheck />{confirming ? "Confirming…" : "Confirm Order"}</button>}
        <button type="button" className="mobile-purchases__primary mobile-order-dialog__done" onClick={onClose}>Done</button>
      </div>
    </dialog>, document.body,
  );
};

export default MobileOrderDetails;
