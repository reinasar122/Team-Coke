import { act, cleanup, fireEvent, renderHook, waitFor } from "@testing-library/react";
import api from "../api";
import { getCurrentWarehouse } from "../utils/warehouseUtils";
import useMobileOrders, { MOBILE_ORDERS_REFRESH_MS } from "./useMobileOrders";

jest.mock("../api", () => ({ get: jest.fn() }));
jest.mock("../utils/warehouseUtils", () => ({
  getCurrentWarehouse: jest.fn(),
  findWarehouseByName: jest.fn(),
}));

const order = {
  order_number: "MSP-20261005-001", customer_name: "Test Customer",
  customer_address: "Cebu City", status: "PENDING", total_amount: "124.50",
  created_at: "2026-10-05T02:24:00+00:00",
  products: [{ id: 1, name: "Coke 1L", quantity: 2, image_url: "https://example.com/coke.jpg" }],
};
const response = (orders = []) => ({ data: { count: orders.length, results: orders, next: null } });

test("confirmed transaction history requests processed orders separately", async () => {
  const { result } = renderHook(() => useMobileOrders("", { processedOnly: true }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(api.get).toHaveBeenCalledWith("mobile-orders/", expect.objectContaining({
    params: { warehouse: 1, limit: 50, offset: 0, processed: true },
  }));
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(document, "hidden", "get").mockReturnValue(false);
  getCurrentWarehouse.mockReturnValue({ id: 1, name: "Main Warehouse" });
  api.get.mockResolvedValue(response());
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test("a saved order appears on the next automatic refresh", async () => {
  const { result } = renderHook(() => useMobileOrders());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.orders).toEqual([]);
  api.get.mockResolvedValue(response([order]));
  await act(async () => jest.advanceTimersByTime(MOBILE_ORDERS_REFRESH_MS));
  expect(result.current.orders[0]).toMatchObject({
    id: order.order_number, customer: "Test Customer", address: "Cebu City",
    total: "124.50", status: "Pending", time: "10:24 AM",
    products: [{ id: 1, name: "Coke 1L", quantity: 2, image: "https://example.com/coke.jpg" }],
  });
  expect(result.current.count).toBe(1);
});

test("status changes update the existing purchase on refresh", async () => {
  api.get.mockResolvedValue(response([order]));
  const { result } = renderHook(() => useMobileOrders());
  await waitFor(() => expect(result.current.orders).toHaveLength(1));
  api.get.mockResolvedValue(response([{ ...order, status: "OUT_FOR_DELIVERY" }]));
  await act(async () => result.current.refresh());
  expect(result.current.orders).toHaveLength(1);
  expect(result.current.orders[0].status).toBe("For Delivery");
  expect(result.current.orders[0].statusClass).toBe("for-delivery");
});

test.each(["CONFIRMED", "ORDER_CONFIRMED", "OUT_FOR_DELIVERY"])("%s orders show For Delivery while preserving their source status", async (status) => {
  api.get.mockResolvedValue(response([{ ...order, status }]));
  const { result } = renderHook(() => useMobileOrders());
  await waitFor(() => expect(result.current.orders).toHaveLength(1));
  expect(result.current.orders[0]).toMatchObject({
    status: "For Delivery", statusClass: "for-delivery", rawStatus: status,
  });
});

test("dispatched van-load orders show For Delivery until an explicit outcome is recorded", async () => {
  api.get.mockResolvedValue(response([
    { ...order, status: "COMPLETE", van_load_sale_id: 12, van_load_batch_id: "batch-1" },
    { ...order, order_number: "MSP-RETURNED", status: "RETURNED", van_load_sale_id: 12 },
  ]));
  const { result } = renderHook(() => useMobileOrders());
  await waitFor(() => expect(result.current.orders).toHaveLength(2));
  expect(result.current.orders[0]).toMatchObject({
    status: "For Delivery", statusClass: "for-delivery", rawStatus: "COMPLETE",
  });
  expect(result.current.orders[1]).toMatchObject({
    status: "Returned", statusClass: "returned",
  });
});

test("failed requests show an error instead of reporting an empty order list", async () => {
  api.get.mockRejectedValue({ response: { status: 503, data: { detail: "Mobile purchases are temporarily unavailable." } } });
  const { result } = renderHook(() => useMobileOrders());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe("Mobile purchases are temporarily unavailable.");
});

test("temporary failures preserve already loaded purchases", async () => {
  api.get.mockResolvedValue(response([order]));
  const { result } = renderHook(() => useMobileOrders());
  await waitFor(() => expect(result.current.orders).toHaveLength(1));
  api.get.mockRejectedValue({ response: { status: 503, data: { detail: "Source unavailable" } } });
  await act(async () => result.current.refresh());
  expect(result.current.orders).toHaveLength(1);
  expect(result.current.error).toBe("Source unavailable");
});

test("expired access clears private order details", async () => {
  api.get.mockResolvedValue(response([order]));
  const { result } = renderHook(() => useMobileOrders());
  await waitFor(() => expect(result.current.orders).toHaveLength(1));
  api.get.mockRejectedValue({ response: { status: 401, data: { detail: "Please sign in again." } } });
  await act(async () => result.current.refresh());
  expect(result.current.orders).toEqual([]);
  expect(result.current.error).toBe("Please sign in again.");
});

test("a previous warehouse's delayed response cannot replace the current warehouse", async () => {
  let finishOldRequest;
  api.get.mockImplementationOnce(() => new Promise((resolve) => { finishOldRequest = resolve; }));
  const { result } = renderHook(() => useMobileOrders());
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  getCurrentWarehouse.mockReturnValue({ id: 2, name: "Other Warehouse" });
  api.get.mockResolvedValue(response([{ ...order, order_number: "OTHER-001" }]));
  await act(async () => fireEvent(window, new Event("warehouseChanged")));
  expect(api.get.mock.calls[1][1].params.warehouse).toBe(2);
  expect(result.current.orders[0].id).toBe("OTHER-001");
  await act(async () => finishOldRequest(response([order])));
  expect(result.current.orders[0].id).toBe("OTHER-001");
});

test("polling pauses while the page is hidden and refreshes when visible again", async () => {
  const hidden = jest.spyOn(document, "hidden", "get");
  const { result } = renderHook(() => useMobileOrders());
  await waitFor(() => expect(result.current.loading).toBe(false));
  hidden.mockReturnValue(true);
  await act(async () => jest.advanceTimersByTime(MOBILE_ORDERS_REFRESH_MS));
  expect(api.get).toHaveBeenCalledTimes(1);
  hidden.mockReturnValue(false);
  await act(async () => fireEvent(document, new Event("visibilitychange")));
  expect(api.get).toHaveBeenCalledTimes(2);
});

test("unmount cancels pending requests and stops refresh polling", async () => {
  api.get.mockImplementation(() => new Promise(() => {}));
  const { unmount } = renderHook(() => useMobileOrders());
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  const signal = api.get.mock.calls[0][1].signal;
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => jest.advanceTimersByTime(MOBILE_ORDERS_REFRESH_MS * 2));
  expect(api.get).toHaveBeenCalledTimes(1);
});
