import React, { useEffect, useState } from "react";
import api from "../api";

const dateLabel = (value) => new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(`${value}T00:00:00+08:00`));

export default function MobilePromotions({ warehouseId, refreshKey }) {
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

  return <section className="mobile-promotions" aria-labelledby="mobile-promotions-title">
    <h2 id="mobile-promotions-title">Promotions</h2>
    <p className="mobile-promotions__hint">Active promotions appear on the mobile home page.</p>
    {!warehouseId ? <p className="mobile-promotions__hint">Select a warehouse to view promotions.</p>
      : state.loading ? <p role="status">Loading promotions…</p>
      : state.error ? <p role="alert" className="mobile-purchases__feedback">{state.error}</p>
      : state.rows.length === 0 ? <p className="mobile-promotions__hint">No promotions yet. Use Add Promotions to create one.</p>
      : <div className="mobile-promotions__list">
        {state.rows.map((promotion) => <article className={`mobile-promotions__card mobile-promotions__card--${promotion.promotion_type}`} key={promotion.id}>
          <div className="mobile-promotions__heading"><h3>{promotion.title}</h3><span>{promotion.status}</span></div>
          <p>{promotion.products.map((product) => product.product_name).join(", ")}</p>
          <small>{dateLabel(promotion.start_date)} – {dateLabel(promotion.end_date)}</small>
        </article>)}
      </div>}
  </section>;
}
