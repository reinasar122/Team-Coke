import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api";

const initialState = { saved: [], available: [], deliveries: [], hasMore: false, loading: true, error: "" };

export const deliveryError = (error) => {
  const data = error?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (data && typeof data === "object") {
    const message = Object.values(data).flat().find((value) => typeof value === "string");
    if (message) return message;
  }
  return "Unable to save delivery details. Please try again.";
};

export default function useMobileDeliveries(warehouseId) {
  const [state, setState] = useState(initialState);
  const requestRef = useRef(0);
  const controllerRef = useRef(null);

  const load = useCallback(async () => {
    if (!warehouseId) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++requestRef.current;
    try {
      const config = { params: { warehouse: warehouseId }, signal: controller.signal };
      const [addresses, deliveries] = await Promise.all([
        api.get("mobile-delivery-addresses/", config),
        api.get("mobile-deliveries/", config),
      ]);
      if (requestId !== requestRef.current || controller.signal.aborted) return;
      setState({
        saved: addresses.data.saved, available: addresses.data.available,
        deliveries: deliveries.data.results, hasMore: Boolean(deliveries.data.next), loading: false, error: "",
      });
    } catch (error) {
      if (requestId !== requestRef.current || controller.signal.aborted) return;
      setState((previous) => ({ ...previous, loading: false, error: deliveryError(error) }));
    }
  }, [warehouseId]);

  useEffect(() => {
    setState(initialState);
    load();
    return () => {
      requestRef.current += 1;
      controllerRef.current?.abort();
    };
  }, [load]);

  const rememberAddress = (address) => setState((previous) => ({
    ...previous, saved: [...previous.saved.filter((item) => item.id !== address.id), address],
  }));
  const rememberDelivery = (delivery) => setState((previous) => ({
    ...previous, deliveries: [delivery, ...previous.deliveries.filter((item) => item.id !== delivery.id)],
  }));
  return { ...state, refreshDeliveries: load, rememberAddress, rememberDelivery };
}
