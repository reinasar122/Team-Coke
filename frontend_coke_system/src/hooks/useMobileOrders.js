import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api";
import { getCurrentWarehouse, findWarehouseByName } from "../utils/warehouseUtils";
import { toPurchaseCard } from "../utils/mobileOrders";

const PAGE_SIZE = 50;
export const MOBILE_ORDERS_REFRESH_MS = 15000;

export default function useMobileOrders(address = "", { processedOnly = false } = {}) {
  const [state, setState] = useState({ orders: [], count: 0, loading: true, refreshing: false, error: "", warehouseId: null });
  const controllerRef = useRef(null);
  const requestRef = useRef(0);
  const pagesRef = useRef(1);
  const mountedRef = useRef(false);

  const loadOrders = useCallback(async ({ reset = false, force = false } = {}) => {
    if (controllerRef.current && !force) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++requestRef.current;
    const isCurrent = () => mountedRef.current && requestId === requestRef.current;
    if (reset) pagesRef.current = 1;
    setState((previous) => ({
      ...previous,
      ...(reset ? { orders: [], count: 0, loading: true } : {}),
      refreshing: true, error: "",
    }));

    try {
      let warehouse = getCurrentWarehouse();
      if (warehouse?.needsIdLookup) warehouse = await findWarehouseByName(warehouse.name);
      if (!isCurrent()) return;
      if (!warehouse?.id) throw new Error("Select a warehouse to view mobile purchases.");
      setState((previous) => ({ ...previous, warehouseId: warehouse.id }));
      const orders = new Map();
      let count = 0;
      for (let page = 0; page < pagesRef.current; page += 1) {
        const response = await api.get("mobile-orders/", {
          params: { warehouse: warehouse.id, limit: PAGE_SIZE, offset: page * PAGE_SIZE, ...(address ? { address } : {}), ...(processedOnly ? { processed: true } : {}) },
          signal: controller.signal,
        });
        if (!isCurrent()) return;
        if (!Array.isArray(response.data?.results) || !Number.isInteger(response.data?.count)) {
          throw new Error("The mobile purchases response could not be read. Please try again.");
        }
        count = response.data.count;
        response.data.results.forEach((order) => orders.set(order.order_number, toPurchaseCard(order)));
        if (!response.data.next) break;
      }
      if (isCurrent()) setState({ orders: [...orders.values()], count, loading: false, refreshing: false, error: "", warehouseId: warehouse.id });
    } catch (error) {
      if (controller.signal.aborted || !isCurrent()) return;
      const status = error?.response?.status;
      const serverMessage = error?.response?.data?.detail;
      const message = typeof serverMessage === "string" ? serverMessage : (
        error?.response ? "No orders yet. Please try again later." :
        error?.message === "Network Error" ? "Unable to connect. Please try again." :
        error.message || "No orders yet. Please try again later."
      );
      setState((previous) => ({
        ...previous,
        ...([401, 403].includes(status) ? { orders: [], count: 0 } : {}),
        loading: false, refreshing: false, error: message,
      }));
    } finally {
      if (requestId === requestRef.current) controllerRef.current = null;
    }
  }, [address, processedOnly]);

  useEffect(() => {
    mountedRef.current = true;
    loadOrders({ reset: true, force: true });
    const resetWarehouse = () => loadOrders({ reset: true, force: true });
    const onStorage = (event) => {
      if (!event.key || ["selectedWarehouse", "user", "token"].includes(event.key)) resetWarehouse();
    };
    const refreshVisible = () => {
      if (!document.hidden) loadOrders();
    };
    const interval = window.setInterval(refreshVisible, MOBILE_ORDERS_REFRESH_MS);
    window.addEventListener("warehouseChanged", resetWarehouse);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
      window.clearInterval(interval);
      window.removeEventListener("warehouseChanged", resetWarehouse);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [loadOrders]);

  const refresh = () => loadOrders({ force: true });
  const loadMore = () => {
    if (controllerRef.current) return;
    pagesRef.current += 1;
    loadOrders();
  };

  return { ...state, refresh, loadMore, hasMore: state.orders.length < state.count };
}
