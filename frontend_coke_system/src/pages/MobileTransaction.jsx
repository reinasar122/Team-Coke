import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { FaMobileAlt, FaUserAlt, FaMapMarkerAlt, FaTimes, FaTruck, FaPrint } from "react-icons/fa";
import api from "../api";
import useMobileOrders from "../hooks/useMobileOrders";
import useMobileDeliveries, { deliveryError } from "../hooks/useMobileDeliveries";
import MobileOrderDetails from "./MobileOrderDetails";
import PromotionsPopup from "./PromotionsPopup";
import MobilePromotions from "../components/MobilePromotions";
import "../styles/pages/mobiletransaction.scss";

const formatAmount = (amount) =>
  new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

const orderNumber = (order) => order.number || order.id;

const canSelect = (order) => !order.isTest && !order.vanLoadSaleId && ["NEW", "PENDING", "CONFIRMED", "ORDER_CONFIRMED", "PROCESSING", "IN_PROGRESS"].includes(order.rawStatus);

const newRequestId = () => {
  if (window.crypto.randomUUID) return window.crypto.randomUUID();
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const PurchaseCard = ({ order, selected, showSelection, onToggle, onOpen, disabled }) => {
  const number = orderNumber(order);
  const extraCount = order.products.length - 2;
  const visibleProducts = order.products.slice(0, 2);

  return (
    <article className={`mobile-purchases__card${selected ? " mobile-purchases__card--selected" : ""}`} aria-labelledby={`purchase-${order.id}`}>
      {showSelection && <label className="mobile-purchases__selection">
        <input type="checkbox" checked={selected} onChange={onToggle} disabled={disabled || !canSelect(order)} />
        <span className="sr-only">Select {number}</span>
      </label>}
      <button type="button" className="mobile-purchases__open-order" disabled={disabled} onClick={canSelect(order) ? onToggle : onOpen} aria-label={`${canSelect(order) ? "Select order" : "View order details for"} ${number}`}>
        <span className="sr-only">{canSelect(order) ? "Select order" : "View order details for"} {number}</span>
      </button>
      <div className="mobile-purchases__details">
        <div className="mobile-purchases__card-heading">
          <h2 id={`purchase-${order.id}`}>{number}</h2>
          <span className="sr-only">{order.status}</span>
        </div>
        {order.isTest && <span className="mobile-purchases__test-label">Test order</span>}
        <p className="mobile-purchases__customer"><FaUserAlt aria-hidden="true" />{order.customer}</p>
        <p className="mobile-purchases__address">
          <FaMapMarkerAlt aria-hidden="true" />
          <span><strong>Delivery address</strong>{order.address}</span>
        </p>
        {order.deliveryId && <p className="mobile-purchases__delivery-label"><FaTruck aria-hidden="true" />Delivery: {order.deliveryAddress}</p>}
        <div className="mobile-purchases__products" id={`products-${order.id}`}>
          <span className="mobile-purchases__preview-products" title={visibleProducts.map((item) => `${item.name} x ${item.quantity} pieces`).join(", ")}>
          {visibleProducts.map((item, index) => (
            <span className="mobile-purchases__preview-item" key={item.id || `${item.name}-${index}`}>
              {index > 0 && ", "}{item.name} x {item.quantity} ({Number(item.quantity) === 1 ? "piece" : "pieces"})
            </span>
          ))}
          </span>
          {extraCount > 0 && (
            <span className="mobile-purchases__more">+{extraCount} more</span>
          )}
        </div>
      </div>
      <div className="mobile-purchases__footer">
        <button type="button" className="mobile-purchases__view-details" onClick={onOpen} aria-label={`View order details for ${number}`}>View</button>
        <time className="mobile-purchases__time" dateTime={order.createdAt} title={order.dateLabel}>{order.time}</time>
        <span className="mobile-purchases__total">Total: <strong>₱ {formatAmount(order.total)}</strong></span>
      </div>
    </article>
  );
};

const PickList = ({ orders }) => createPortal(
  <section className="mobile-purchases-print">
    <h1>Mobile Purchases — Pick List</h1>
    {orders.map((order) => <article key={order.id}>
      <h2>{orderNumber(order)} · {order.status}</h2>
      <p>{order.customer} · {order.address}</p>
      <table><thead><tr><th>Product</th><th>Quantity (pieces)</th></tr></thead><tbody>
        {order.products.map((item, index) => <tr key={item.id || index}><td>{item.name}</td><td>{item.quantity}</td></tr>)}
      </tbody></table><p>Total: ₱ {formatAmount(order.total)}</p>
    </article>)}
  </section>, document.body,
);

const MobileTransaction = () => {
  const navigate = useNavigate();
  const confirmingRef = useRef(false);
  const [addressFilter, setAddressFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const { orders, count, loading, refreshing, error, loadMore, hasMore, warehouseId, refresh } = useMobileOrders(addressFilter);
  const confirmedHistory = useMobileOrders("", { processedOnly: true });
  const deliveryState = useMobileDeliveries(warehouseId);
  const [selectedOrders, setSelectedOrders] = useState(() => new Map());
  const [addingAddress, setAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [saving, setSaving] = useState("");
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const [activeOrder, setActiveOrder] = useState(null);
  const [recentlyConfirmed, setRecentlyConfirmed] = useState(() => new Map());
  const [showPromotions, setShowPromotions] = useState(false);
  const [promotionVersion, setPromotionVersion] = useState(0);
  const warehouseRef = useRef(warehouseId);
  const deliveryRequestRef = useRef(null);
  warehouseRef.current = warehouseId;

  useEffect(() => {
    setSelectedOrders(new Map());
    setAddressFilter("");
    setSortOrder("newest");
    setDestinationId("");
    setAddingAddress(false);
    setNewAddress("");
    setActionError("");
    setMessage("");
    setSaving("");
    setActiveOrder(null);
    setRecentlyConfirmed(new Map());
    deliveryRequestRef.current = null;
  }, [warehouseId]);

  useEffect(() => {
    setSelectedOrders((current) => {
      const next = new Map(current);
      orders.forEach((order) => {
        if (!canSelect(order)) next.delete(order.id);
        else if (next.has(order.id)) next.set(order.id, order);
      });
      return next;
    });
  }, [orders]);

  useEffect(() => {
    setRecentlyConfirmed((current) => {
      const next = new Map(current);
      orders.forEach((order) => {
        if (!next.has(order.id)) return;
        if (order.statusClass === "cancelled") next.delete(order.id);
        else if (["confirmed", "processing", "completed"].includes(order.statusClass)) next.set(order.id, order);
      });
      return next;
    });
  }, [orders]);

  useEffect(() => {
    if (error && orders.length === 0) {
      setActiveOrder(null);
      setRecentlyConfirmed(new Map());
    }
  }, [error, orders.length]);

  const toggleOrder = (order) => {
    setSelectedOrders((current) => {
      const next = new Map(current);
      if (next.has(order.id)) next.delete(order.id);
      else if (canSelect(order)) next.set(order.id, order);
      return next;
    });
  };

  const saveAddress = async (event) => {
    event.preventDefault();
    if (!warehouseId || saving) return;
    const scope = warehouseId;
    setSaving("address");
    setActionError("");
    setMessage("");
    try {
      const response = await api.post("mobile-delivery-addresses/", { address: newAddress.trim() }, { params: { warehouse: scope } });
      if (warehouseRef.current !== scope) return;
      deliveryState.rememberAddress(response.data);
      setDestinationId(String(response.data.id));
      setAddingAddress(false);
      setNewAddress("");
      setMessage("Delivery address saved.");
      deliveryState.refreshDeliveries();
    } catch (failure) {
      if (warehouseRef.current === scope) setActionError(deliveryError(failure));
    } finally {
      if (warehouseRef.current === scope) setSaving("");
    }
  };

  const createDelivery = async () => {
    if (!warehouseId || !destinationId || selectedOrders.size === 0 || saving) return;
    const scope = warehouseId;
    const numbers = [...selectedOrders.keys()].sort();
    const key = JSON.stringify([scope, destinationId, numbers]);
    if (deliveryRequestRef.current?.key !== key) deliveryRequestRef.current = { key, id: newRequestId() };
    setSaving("delivery");
    setActionError("");
    setMessage("");
    try {
      const response = await api.post("mobile-deliveries/", {
        destination_id: Number(destinationId), order_numbers: numbers, request_id: deliveryRequestRef.current.id,
      }, { params: { warehouse: scope } });
      if (warehouseRef.current !== scope) return;
      deliveryState.rememberDelivery(response.data);
      setSelectedOrders(new Map());
      deliveryRequestRef.current = null;
      setMessage(`${numbers.length} order${numbers.length === 1 ? "" : "s"} grouped into one delivery.`);
      refresh();
      deliveryState.refreshDeliveries();
    } catch (failure) {
      if (warehouseRef.current === scope) setActionError(deliveryError(failure));
    } finally {
      if (warehouseRef.current === scope) setSaving("");
    }
  };

  const filterAddresses = [...new Set([...deliveryState.available, ...deliveryState.saved.map((item) => item.address), ...orders.map((order) => order.address).filter((address) => address !== "Address unavailable")])].sort((a, b) => a.localeCompare(b));
  const eligibleOrders = orders.filter(canSelect);
  const selected = [...selectedOrders.values()];
  const visibleOrders = [...orders].sort((a, b) => {
    const newestFirst = new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    return sortOrder === "oldest" ? -newestFirst : newestFirst;
  });
  const statusOrders = [...new Map([
    ...orders.map((order) => [order.id, order]),
    ...confirmedHistory.orders.map((order) => [order.id, order]),
    ...recentlyConfirmed,
  ]).values()]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const confirmOrders = async (chosen) => {
    if (!warehouseId || saving || confirmingRef.current || chosen.length === 0 || chosen.length > 100) return;
    const scope = warehouseId;
    confirmingRef.current = true;
    setSaving("confirm");
    setActionError("");
    try {
      const { data } = await api.post("mobile-orders/van-load/", {
        order_numbers: chosen.map((order) => order.id).sort(),
      }, { params: { warehouse: scope } });
      if (warehouseRef.current !== scope) return;
      if (!data.id || data.status !== "PROCESSING" || !data.items?.length || Number(data.warehouse) !== Number(scope)) {
        throw new Error("The van-load handoff could not be verified. Retry the same selection.");
      }
      refresh();
      confirmedHistory.refresh();
      if (data.sale_id) navigate(`/van-load-product-details/${data.sale_id}`);
      else navigate("/merchandising-sale", { state: { transactionTypeName: "Van Load", mobileVanLoad: data } });
    } catch (failure) {
      if (warehouseRef.current === scope) setActionError(failure.response ? deliveryError(failure) : failure.message);
      throw failure;
    } finally {
      confirmingRef.current = false;
      if (warehouseRef.current === scope) setSaving("");
    }
  };

  return (
    <section className="mobile-purchases" aria-labelledby="mobile-purchases-heading">
      <header className="page-header mobile-purchases__header">
        <h1 id="mobile-purchases-heading" className="page-title"><FaMobileAlt aria-hidden="true" />MOBILE PURCHASES</h1>
      </header>
      <div className="mobile-purchases__layout">
       <div className="mobile-purchases__main">
         <div className="mobile-purchases__topbar">
           <div className="mobile-purchases__topbar-left">
             <button type="button" className="mobile-purchases__add-promotions" disabled={!warehouseId} onClick={() => setShowPromotions(true)}>ADD PROMOTIONS</button>
           </div>
           <div className="mobile-purchases__topbar-right">
             <label className="sr-only" htmlFor="mobile-address-filter">Filter by Address</label>
             <select id="mobile-address-filter" value={addressFilter} disabled={Boolean(saving)} onChange={(event) => setAddressFilter(event.target.value)}>
               <option value="">Address</option>
               {filterAddresses.map((address) => <option key={address} value={address}>{address}</option>)}
             </select>
             <label className="sr-only" htmlFor="mobile-purchase-sort">Sort purchases</label>
             <select id="mobile-purchase-sort" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
               <option value="newest">Newest</option>
               <option value="oldest">Oldest</option>
             </select>
           </div>
         </div>
      <MobilePromotions warehouseId={warehouseId} refreshKey={promotionVersion} />
      {error && (
        <div className="mobile-purchases__error" role="alert">
          <span>{error}</span>
        </div>
      )}
      {loading ? (
        <div className="mobile-purchases__empty" role="status">Loading mobile purchases…</div>
      ) : orders.length === 0 && !error ? (
        <div className="mobile-purchases__empty">{addressFilter ? "No orders match this address." : "No order like that. It was already implemented."}</div>
      ) : orders.length > 0 ? (
        <div className="mobile-purchases__grid">
          {visibleOrders.map((order) => (
            <PurchaseCard key={order.id} order={recentlyConfirmed.get(order.id) || order} selected={selectedOrders.has(order.id)} showSelection={selectedOrders.size > 0} onToggle={() => toggleOrder(order)} onOpen={() => setActiveOrder(recentlyConfirmed.get(order.id) || order)} disabled={Boolean(saving)} />
          ))}
        </div>
      ) : null}
      {hasMore && !loading && orders.length > 0 && (
        <div className="mobile-purchases__pagination">
          <span>{orders.length} of {count} purchases</span>
          <button type="button" className="mobile-purchases__refresh" onClick={loadMore} disabled={refreshing}>Load more</button>
        </div>
      )}
      </div>
      <aside className="mobile-purchases__panel" aria-labelledby="mobile-order-status-heading">
        <h2 id="mobile-order-status-heading" className="mobile-purchases__status-title">Order Status</h2>
        <div className="table-wrapper mobile-purchases__transactions">
          <table className="table table-hover" aria-label="Mobile order statuses">
            <thead><tr><th scope="col" className="text-left">Transaction No.</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {statusOrders.map((order) => (
                <tr key={order.id}>
                  <td className="text-left"><button type="button" onClick={() => setActiveOrder(order)} aria-label={`View order status for ${orderNumber(order)}`}>{orderNumber(order)}</button></td>
                  <td><span className={`mobile-purchases__status mobile-purchases__status--${order.statusClass}`}>{order.status}</span></td>
                </tr>
              ))}
              {statusOrders.length === 0 && (
                <tr><td colSpan={2} className="mobile-purchases__status-empty">{confirmedHistory.loading ? "Loading order statuses…" : "No order statuses yet."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {confirmedHistory.error && <p className="mobile-purchases__feedback" role="alert">{confirmedHistory.error}</p>}
        {confirmedHistory.hasMore && <button type="button" className="mobile-purchases__link" disabled={confirmedHistory.refreshing} onClick={confirmedHistory.loadMore}>Load more transactions</button>}
      </aside>
      </div>
      {(selected.length > 0 || addingAddress || actionError || deliveryState.error || message || deliveryState.deliveries.length > 0) && (
      <details id="mobile-delivery-tools" className="mobile-purchases__management" open={selected.length > 0 || addingAddress || Boolean(actionError || deliveryState.error || message)}>
        <summary><FaTruck aria-hidden="true" />Delivery tools{selected.length > 0 ? ` (${selected.length} selected)` : ""}</summary>
        <div className="mobile-purchases__panel-section">
          <div className="mobile-purchases__panel-heading">
            <h2>Selected Orders ({selectedOrders.size})</h2>
            <button type="button" className="mobile-purchases__link" disabled={Boolean(saving) || selectedOrders.size === 0} onClick={() => setSelectedOrders(new Map())}>Clear All</button>
          </div>
          <div className="mobile-purchases__selected-orders">
            {selected.map((order) => <span className="mobile-purchases__selected-order" key={order.id}>{orderNumber(order)}<button type="button" aria-label={`Remove ${orderNumber(order)} from selection`} disabled={Boolean(saving)} onClick={() => toggleOrder(order)}><FaTimes aria-hidden="true" /></button></span>)}
            {selected.length === 0 && <p className="mobile-purchases__hint">Select orders using the checkboxes.</p>}
          </div>
          <button type="button" className="mobile-purchases__link" disabled={loading || Boolean(saving) || eligibleOrders.length === 0} onClick={() => setSelectedOrders((current) => new Map([...current, ...eligibleOrders.map((order) => [order.id, order])]))}>Select visible orders</button>
          <div className="mobile-purchases__order-actions">
            <button type="button" className="btn btn-primary" disabled={Boolean(saving) || selected.length === 0 || selected.length > 100} onClick={() => confirmOrders(selected).catch(() => {})}>{saving === "confirm" ? "Confirming…" : "Confirm Orders → Van Load"}</button>
            <button type="button" className="mobile-purchases__print-button" disabled={Boolean(saving) || selected.length === 0} onClick={() => window.print()}><FaPrint />Print Pick List</button>
          </div>
        </div>
        {addingAddress && (
          <div className="mobile-purchases__panel-section">
          <form id="mobile-add-address" className="mobile-purchases__address-form" onSubmit={saveAddress}>
            <label htmlFor="mobile-new-address">New delivery address / area</label>
            <input id="mobile-new-address" value={newAddress} onChange={(event) => setNewAddress(event.target.value)} maxLength={255} required autoFocus placeholder="e.g. Greenview, Cebu City" disabled={Boolean(saving)} />
            <div className="mobile-purchases__panel-actions">
              <button type="submit" className="mobile-purchases__primary" disabled={!newAddress.trim() || Boolean(saving)}>{saving === "address" ? "Saving…" : "Save Address"}</button>
              <button type="button" className="mobile-purchases__refresh" disabled={Boolean(saving)} onClick={() => setAddingAddress(false)}>Cancel</button>
            </div>
          </form>
          </div>
        )}
        <details className="mobile-purchases__panel-section mobile-purchases__delivery-options">
          <summary><FaTruck />Group into One Delivery</summary>
          <label htmlFor="mobile-delivery-destination">Delivery address / area</label>
          <select id="mobile-delivery-destination" value={destinationId} disabled={Boolean(saving)} onChange={(event) => setDestinationId(event.target.value)}>
            <option value="">Choose a saved address</option>
            {deliveryState.saved.map((item) => <option key={item.id} value={item.id}>{item.address}</option>)}
          </select>
          <p className="mobile-purchases__hint">Use + to save an address. Selected orders stay selected when you change the filter.</p>
          <button type="button" className="mobile-purchases__primary mobile-purchases__group-button" disabled={loading || Boolean(saving) || !warehouseId || !destinationId || selectedOrders.size === 0 || selectedOrders.size > 100} onClick={createDelivery}><FaTruck aria-hidden="true" />{saving === "delivery" ? "Grouping…" : "Group into One Delivery"}</button>
          {selectedOrders.size > 100 && <p className="mobile-purchases__feedback" role="alert">Select up to 100 orders per delivery.</p>}
        </details>
        {(actionError || deliveryState.error) && <p className="mobile-purchases__feedback" role="alert">{actionError || deliveryState.error}</p>}
        {message && <p className="mobile-purchases__success" role="status">{message}</p>}
        {deliveryState.deliveries.length > 0 && <div className="mobile-purchases__panel-section">
          <h2>Recent Delivery Groups</h2>
          {deliveryState.deliveries.slice(0, 5).map((delivery) => <div className="mobile-purchases__delivery-summary" key={delivery.id}><strong>{delivery.address}</strong><span>{delivery.order_numbers.length} order{delivery.order_numbers.length === 1 ? "" : "s"}</span><small>{delivery.order_numbers.join(", ")}</small></div>)}
          {(deliveryState.hasMore || deliveryState.deliveries.length > 5) && <p className="mobile-purchases__hint">Showing the 5 most recent delivery groups.</p>}
        </div>}
      </details>
      )}
      {activeOrder && <MobileOrderDetails key={activeOrder.id} order={activeOrder} warehouseId={warehouseId} onClose={() => setActiveOrder(null)} onConfirm={(order) => confirmOrders([order])} />}
          {showPromotions && <PromotionsPopup key={warehouseId} warehouseId={warehouseId} onSaved={() => setPromotionVersion((version) => version + 1)} onClose={() => setShowPromotions(false)} />}
      <PickList orders={selected} />
    </section>
  );
};

export default MobileTransaction;
