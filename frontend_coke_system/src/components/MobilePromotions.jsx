import React, { useEffect, useState } from "react";
import api from "../api";

const dateLabel = (value) => new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(`${value}T00:00:00+08:00`));

export default function MobilePromotions({ warehouseId, refreshKey, onEdit }) {
  const [state, setState] = useState({ rows: [], loading: true, error: "" });
  useEffect(() => {
    if (!warehouseId) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const { data } = await api.get("promotions/", { params: { warehouse: warehouseId }, signal: controller.signal });
        if (!Array.isArray(data)) throw new Error("Could not read promotions.");
        if (!controller.signal.aborted) setState({ rows: data, loading: false, error: "" });
      } catch (failure) {
        if (!controller.signal.aborted) setState({ rows: [], loading: false, error: failure.response?.data?.detail || "Could not load promotions. Please refresh the page." });
      }
    };
    setState({ rows: [], loading: true, error: "" });
    load();
    const timer = window.setInterval(() => { if (!document.hidden) load(); }, 60000);
    window.addEventListener("focus", load);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", load); };
  }, [warehouseId, refreshKey]);
  const visibleRows = state.rows.filter((promotion) => promotion.status !== "Expired");

  return <section className="mobile-promotions" aria-labelledby="mobile-promotions-title">
    <h2 id="mobile-promotions-title">Promotions</h2>
    <p className="mobile-promotions__hint">Active promotions appear on the mobile home page.</p>
    {!warehouseId ? <p className="mobile-promotions__hint">Select a warehouse to view promotions.</p>
      : state.loading ? <p role="status">Loading promotions…</p>
      : state.error ? <p role="alert" className="mobile-purchases__feedback">{state.error}</p>
      : visibleRows.length === 0 ? <p className="mobile-promotions__hint">No current or upcoming promotions. Use Add Promotions to create one.</p>
      : <div className="mobile-promotions__list">
        {visibleRows.map((promotion) => {
          const editable = promotion.status === "Active" && Boolean(onEdit);
          return <article
            className={`mobile-promotions__card mobile-promotions__card--${promotion.promotion_type}${editable ? " mobile-promotions__card--editable" : ""}`}
            key={promotion.id}
            role={editable ? "button" : undefined}
            tabIndex={editable ? 0 : undefined}
            aria-label={editable ? `${promotion.title}, edit promotion` : undefined}
            onClick={editable ? () => onEdit(promotion) : undefined}
            onKeyDown={editable ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onEdit(promotion);
              }
            } : undefined}
          >
            <div className="mobile-promotions__heading"><h3>{promotion.title}</h3><span>{promotion.status}</span></div>
            <p>{promotion.products.map((product) => product.product_name).join(", ")}</p>
            <small>{dateLabel(promotion.start_date)} – {dateLabel(promotion.end_date)}</small>
          </article>;
        })}
      </div>}
  </section>;
}
