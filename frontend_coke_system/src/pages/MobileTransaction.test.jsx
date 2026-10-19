import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import MobileTransaction from "./MobileTransaction";
import api from "../api";
import useMobileOrders from "../hooks/useMobileOrders";
import useMobileDeliveries from "../hooks/useMobileDeliveries";
import { toPurchaseCard } from "../utils/mobileOrders";

jest.mock("../api", () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));
jest.mock("../hooks/useMobileOrders");
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock("../components/MobilePromotions", () => () => null);
jest.mock("../hooks/useMobileDeliveries", () => ({
  __esModule: true, default: jest.fn(), deliveryError: (error) => error.response?.data?.detail || "Request failed",
}));

const rawOrder = {
  order_number: "ORD-1001", customer_name: "Maria Santos", customer_address: "Greenview, Cebu City",
  status: "PENDING", total_amount: "320.00", created_at: "2026-10-12T02:24:00Z",
  products: [
    { id: 1, name: "Coke 1.5L", quantity: 2 },
    { id: 2, name: "Sprite 1.5L", quantity: 1 },
    { id: 3, name: "Royal 1.5L", quantity: 3 },
  ],
};
let orderState;
let historyState;
const preparedBatch = {
  id: "batch-1", warehouse: 1, status: "PROCESSING", order_numbers: ["ORD-1001"],
  items: [{ product_id: 51, product_name: "Coke 1.5L", quantity: 2 }],
};
const selectOrder = (number) => {
  const checkbox = screen.queryByRole("checkbox", { name: `Select ${number}` });
  fireEvent.click(checkbox || screen.getByRole("button", { name: `Select order ${number}` }));
};

test("clicking an order reveals checkboxes and bulk confirmation passes three unique orders", async () => {
  orderState.orders = [1, 2, 3].map((index) => toPurchaseCard({ ...rawOrder, order_number: `ORD-100${index}` }));
  render(<MobileTransaction />);
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  selectOrder("ORD-1001");
  expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  expect(screen.getByRole("checkbox", { name: "Select ORD-1001" })).toBeChecked();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  selectOrder("ORD-1002");
  selectOrder("ORD-1003");
  fireEvent.click(screen.getByRole("button", { name: "Confirm Orders → Van Load" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith("mobile-orders/van-load/", { order_numbers: ["ORD-1001", "ORD-1002", "ORD-1003"] }, { params: { warehouse: 1 } }));
  expect(api.patch).not.toHaveBeenCalled();
});

test("Returned is displayed as an order result and cannot be selected for another van load", () => {
  orderState.orders = [toPurchaseCard({ ...rawOrder, status: "RETURNED" })];
  render(<MobileTransaction />);
  expect(within(screen.getByRole("table", { name: "Mobile order statuses" })).getByText("Returned")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Select order ORD-1001" })).not.toBeInTheDocument();
});

test("public MO numbers are displayed while detail and confirmation use the source reference", async () => {
  const publicOrder = { ...rawOrder, mobile_order_number: "MO-0009" };
  orderState.orders = [toPurchaseCard(publicOrder)];
  api.get.mockResolvedValue({ data: publicOrder });
  api.post.mockResolvedValue({ data: preparedBatch });
  render(<MobileTransaction />);
  expect(document.querySelector(".mobile-purchases__card h2")).toHaveTextContent("MO-0009");
  fireEvent.click(screen.getByRole("button", { name: "View order details for MO-0009" }));
  const dialog = screen.getByRole("dialog", { name: "MO-0009" });
  const confirm = within(dialog).getByRole("button", { name: "Confirm Order" });
  await waitFor(() => expect(confirm).toBeEnabled());
  expect(api.get).toHaveBeenCalledWith("mobile-orders/ORD-1001/", expect.objectContaining({ params: { warehouse: 1 } }));
  fireEvent.click(confirm);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith("mobile-orders/van-load/", { order_numbers: ["ORD-1001"] }, { params: { warehouse: 1 } }));
  const table = screen.getByRole("table", { name: "Mobile order statuses" });
  expect(within(table).getByText("MO-0009")).toBeInTheDocument();
  expect(mockNavigate).toHaveBeenCalledWith("/merchandising-sale", { state: { transactionTypeName: "Van Load", mobileVanLoad: preparedBatch } });
});

beforeEach(() => {
  jest.clearAllMocks();
  HTMLDialogElement.prototype.showModal = jest.fn(function () { this.setAttribute("open", ""); });
  HTMLDialogElement.prototype.close = jest.fn(function () { this.removeAttribute("open"); });
  orderState = {
    orders: [toPurchaseCard(rawOrder)], count: 1, loading: false, refreshing: false,
    error: "", hasMore: false, warehouseId: 1, refresh: jest.fn(), loadMore: jest.fn(),
  };
  historyState = { ...orderState, orders: [], refresh: jest.fn() };
  useMobileOrders.mockImplementation((address, options) => options?.processedOnly ? historyState : orderState);
  useMobileDeliveries.mockReturnValue({
    available: [], saved: [], deliveries: [], error: "", rememberAddress: jest.fn(),
    rememberDelivery: jest.fn(), refreshDeliveries: jest.fn(),
  });
  api.get.mockResolvedValue({ data: rawOrder });
  api.post.mockResolvedValue({ data: preparedBatch });
});

test("clicking a card opens fresh details including products hidden from its preview", async () => {
  render(<MobileTransaction />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View order details for ORD-1001" }));
  const dialog = screen.getByRole("dialog", { name: "ORD-1001" });
  await waitFor(() => expect(within(dialog).queryByRole("status")).not.toBeInTheDocument());
  expect(api.get).toHaveBeenCalledWith("mobile-orders/ORD-1001/", expect.objectContaining({ params: { warehouse: 1 } }));
  expect(within(dialog).getByText("Royal 1.5L")).toBeInTheDocument();
  expect(within(dialog).getByText("₱ 320.00")).toBeInTheDocument();
  expect(within(dialog).getByText("Greenview, Cebu City")).toBeInTheDocument();
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.click(within(dialog).getByRole("button", { name: "Close order details" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe("");
});

test("fresh details show saved prices, discounts and subtotals without inventing missing prices", async () => {
  api.get.mockResolvedValue({ data: {
    ...rawOrder, total_amount: "52.47", products: [
      { id: 1, name: "Discounted product", quantity: 3, unit_price: "19.99", discount_percent: "12.50", line_total: "52.47" },
      { id: 2, name: "Free product", quantity: 1, unit_price: "0.00", discount_percent: "0", line_total: "0.00" },
      { id: 3, name: "Legacy product", quantity: 2 },
    ],
  } });
  render(<MobileTransaction />);
  fireEvent.click(screen.getByRole("button", { name: "View order details for ORD-1001" }));
  const dialog = screen.getByRole("dialog");
  const discountedRow = (await within(dialog).findByText("Discounted product")).closest("li");
  expect(discountedRow).toHaveTextContent("3 pieces × ₱ 19.99");
  expect(discountedRow).toHaveTextContent("Less 12.5% discount");
  expect(discountedRow).toHaveTextContent("₱ 52.47");
  const freeRow = within(dialog).getByText("Free product").closest("li");
  expect(freeRow).toHaveTextContent("1 piece × ₱ 0.00");
  expect(freeRow).not.toHaveTextContent("Price breakdown unavailable");
  const legacyRow = within(dialog).getByText("Legacy product").closest("li");
  expect(legacyRow).toHaveTextContent("2 pieces");
  expect(legacyRow).toHaveTextContent("Price breakdown unavailable");
  expect(legacyRow).not.toHaveTextContent("₱ 0.00");
});

test("cards, details and pick lists show the checkout address separately from the delivery group", async () => {
  const checkoutAddress = "Purok Tulingan, Palanas, Ginatilan, Cebu, Philippines";
  const mobileOrder = {
    ...rawOrder, order_address: checkoutAddress,
    delivery_id: "delivery-1", delivery_address: "Shared delivery drop-off",
  };
  orderState.orders = [toPurchaseCard(mobileOrder)];
  api.get.mockResolvedValue({ data: mobileOrder });
  const { rerender } = render(<MobileTransaction />);
  const card = screen.getByRole("article", { name: "ORD-1001" });
  expect(within(card).getByText("Delivery address")).toBeInTheDocument();
  expect(within(card).getByText(checkoutAddress)).toBeInTheDocument();
  expect(card).toHaveTextContent("Delivery: Shared delivery drop-off");
  expect(card).not.toHaveTextContent(rawOrder.customer_address);
  fireEvent.click(within(card).getByRole("button", { name: "View order details for ORD-1001" }));
  const dialog = screen.getByRole("dialog");
  await waitFor(() => expect(within(dialog).queryByText("Refreshing order details…")).not.toBeInTheDocument());
  expect(within(dialog).getByText(checkoutAddress)).toBeInTheDocument();
  expect(within(dialog).getByText("Shared delivery drop-off")).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));

  // An ungrouped order can be selected for the pick list.
  orderState.orders = [toPurchaseCard({ ...mobileOrder, delivery_id: null })];
  rerender(<MobileTransaction />);
  selectOrder("ORD-1001");
  const pickList = document.querySelector(".mobile-purchases-print");
  expect(pickList).toHaveTextContent(checkoutAddress);
  expect(pickList).not.toHaveTextContent(rawOrder.customer_address);
});

test("confirmation hands selected orders to Van Load after server acknowledgment", async () => {
  render(<MobileTransaction />);
  selectOrder("ORD-1001");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByText("Selected Orders (1)")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Confirm Orders → Van Load" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "View order details for ORD-1001" }));
  const confirm = await screen.findByRole("button", { name: "Confirm Order" });
  await waitFor(() => expect(confirm).toBeEnabled());
  fireEvent.click(confirm);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith("mobile-orders/van-load/", { order_numbers: ["ORD-1001"] }, { params: { warehouse: 1 } }));
  const history = screen.getByRole("table", { name: "Mobile order statuses" });
  expect(within(history).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Transaction No.", "Status"]);
  expect(within(history).getByText("ORD-1001")).toBeInTheDocument();
  expect(mockNavigate).toHaveBeenCalledWith("/merchandising-sale", { state: { transactionTypeName: "Van Load", mobileVanLoad: preparedBatch } });
  expect(screen.getByText("Order Status")).toBeInTheDocument();
  expect(orderState.refresh).toHaveBeenCalled();
  expect(historyState.refresh).toHaveBeenCalled();
});

test("failed confirmation keeps the selection and reports the API error", async () => {
  api.post.mockRejectedValue({ response: { data: { detail: "Insufficient stock. This order was not confirmed." } } });
  render(<MobileTransaction />);
  selectOrder("ORD-1001");
  fireEvent.click(screen.getByRole("button", { name: "View order details for ORD-1001" }));
  const confirm = await screen.findByRole("button", { name: "Confirm Order" });
  await waitFor(() => expect(confirm).toBeEnabled());
  fireEvent.click(confirm);
  await waitFor(() => expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Insufficient stock. This order was not confirmed."));
  expect(screen.getByRole("checkbox")).toBeChecked();
  expect(screen.queryByText("Order confirmed. Product stock updated.")).not.toBeInTheDocument();
  const statuses = screen.getByRole("table", { name: "Mobile order statuses" });
  expect(within(statuses).getByText("ORD-1001")).toBeInTheDocument();
  expect(within(statuses).getByText("Pending")).toBeInTheDocument();
  expect(within(statuses).queryByText("Confirmed")).not.toBeInTheDocument();
});

test("confirmed history survives reopening the page and is independent of the address filter", async () => {
  const confirmed = toPurchaseCard({ ...rawOrder, status: "CONFIRMED" });
  historyState.orders = [confirmed];
  orderState.orders = [];
  api.get.mockResolvedValue({ data: { ...rawOrder, status: "CONFIRMED" } });
  render(<MobileTransaction />);
  expect(useMobileOrders).toHaveBeenCalledWith("", { processedOnly: true });
  const table = screen.getByRole("table", { name: "Mobile order statuses" });
  expect(within(table).getByText("ORD-1001")).toBeInTheDocument();
  fireEvent.click(within(table).getByRole("button", { name: "View order status for ORD-1001" }));
  await waitFor(() => expect(screen.queryByText("Refreshing order details…")).not.toBeInTheDocument());
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirm Order" })).not.toBeInTheDocument();
});

test("Escape closes details and changing warehouse clears the open order", async () => {
  const { rerender } = render(<MobileTransaction />);
  fireEvent.click(screen.getByRole("button", { name: "View order details for ORD-1001" }));
  await waitFor(() => expect(screen.queryByText("Refreshing order details…")).not.toBeInTheDocument());
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false, cancelable: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View order details for ORD-1001" }));
  orderState = { ...orderState, warehouseId: 2, orders: [] };
  rerender(<MobileTransaction />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("pick list prints selected orders only and includes all their products", () => {
  orderState.orders.push(toPurchaseCard({ ...rawOrder, order_number: "ORD-1002" }));
  const print = jest.spyOn(window, "print").mockImplementation(() => {});
  render(<MobileTransaction />);
  expect(screen.queryByRole("button", { name: "Print Pick List" })).not.toBeInTheDocument();
  selectOrder("ORD-1001");
  fireEvent.click(screen.getByRole("button", { name: "Print Pick List" }));
  expect(print).toHaveBeenCalledTimes(1);
  const pickList = document.querySelector(".mobile-purchases-print");
  expect(pickList).toHaveTextContent("ORD-1001");
  expect(pickList).not.toHaveTextContent("ORD-1002");
  expect(pickList).toHaveTextContent("Royal 1.5L");
  print.mockRestore();
});

test("Newest and Oldest reorder the purchase cards without changing selection", () => {
  orderState.orders.push(toPurchaseCard({ ...rawOrder, order_number: "ORD-1002", created_at: "2026-10-11T02:24:00Z" }));
  render(<MobileTransaction />);
  const purchaseNumbers = () => [...document.querySelectorAll(".mobile-purchases__card h2")].map((heading) => heading.textContent);
  expect(purchaseNumbers()).toEqual(["ORD-1001", "ORD-1002"]);
  selectOrder("ORD-1001");
  fireEvent.change(screen.getByRole("combobox", { name: "Sort purchases" }), { target: { value: "oldest" } });
  expect(purchaseNumbers()).toEqual(["ORD-1002", "ORD-1001"]);
  expect(screen.getByRole("checkbox", { name: "Select ORD-1001" })).toBeChecked();
  fireEvent.change(screen.getByRole("combobox", { name: "Sort purchases" }), { target: { value: "newest" } });
  expect(purchaseNumbers()).toEqual(["ORD-1001", "ORD-1002"]);
});

test("the toolbar address filter keeps selected orders and can open the saved address form", () => {
  useMobileDeliveries.mockReturnValue({
    available: [rawOrder.customer_address], saved: [], deliveries: [], error: "", rememberAddress: jest.fn(),
    rememberDelivery: jest.fn(), refreshDeliveries: jest.fn(),
  });
  render(<MobileTransaction />);
  selectOrder("ORD-1001");
  fireEvent.change(screen.getByRole("combobox", { name: "Filter by Address" }), { target: { value: rawOrder.customer_address } });
  expect(useMobileOrders).toHaveBeenCalledWith(rawOrder.customer_address);
  expect(screen.getByRole("checkbox", { name: "Select ORD-1001" })).toBeChecked();
});

