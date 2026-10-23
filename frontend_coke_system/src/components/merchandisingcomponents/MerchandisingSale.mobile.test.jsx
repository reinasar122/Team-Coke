import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import MerchandisingSale from "./MerchandisingSale";
import api from "../../api";

const mockNavigate = jest.fn();
const mockBatch = { id: null, status: "DRAFT", warehouse: 1, order_numbers: ["WA-0001", "WA-0002", "WA-0003"], items: [{ product_id: 75, product_name: "Coke", quantity: 6 }] };
const mockLocation = { pathname: "/merchandising-sale", key: "mobile", state: { transactionTypeName: "Van Load", mobileVanLoad: mockBatch } };
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate, useLocation: () => mockLocation }), { virtual: true });
jest.mock("../../api", () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));
jest.mock("./ProductTable", () => () => null);
jest.mock("../PaymentModal", () => () => null);
jest.mock("../ReservedDateModal", () => () => null);
jest.mock("./CustomerRegistration", () => () => null);
jest.mock("../../pages/VanForm", () => () => null);

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("user", JSON.stringify({ id: 2, username: "cashier", role: "cashier", warehouse_id: 1 }));
  api.get.mockImplementation((url) => {
    const path = url.replace(/^\//, "").split("?")[0];
    const fixtures = {
      "stocks/": [{ product: 75, warehouse: 1, quantity_available: 0 }],
      "products/": [{ id: 75, product_name: "Coke", warehouse: 1, unit_type: { id: 1, content_no: 24 }, price: { id: 1, selling_price: "10.00" } }],
      "transaction-types/": [{ id: 1, name: "Warehouse" }, { id: 2, name: "Van Load" }],
      "users/": [{ id: 2, username: "cashier" }],
      "routes/": [{ id: 3, route_name: "Town route" }],
      "vans/": [{ id: 4, van_id: "V1", plate_number: "TEST-001" }],
      "merchandisings/msp-next/": { msp_no: "VL-001" },
    };
    return Promise.resolve({ data: fixtures[path] || [] });
  });
  api.post.mockResolvedValue({ data: { id: 91, msp_no: "VL-001", warehouse: 1 } });
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  document.querySelectorAll("body > .fixed").forEach((element) => element.remove());
});

test("mobile preview preloads Van Load without saving and commits through the dispatch endpoint only on For Delivery", async () => {
  render(<MerchandisingSale />);
  const product = await screen.findByText("Coke");
  const row = product.closest("tr");
  expect(within(row).getAllByRole("spinbutton")[1]).toHaveValue(6);
  expect(within(row).getAllByRole("spinbutton")[1]).toBeDisabled();
  expect(screen.getByText("Transaction Type").parentElement.querySelector("input")).toHaveValue("Van Load");
  await screen.findByRole("option", { name: "V1 - TEST-001" });
  const selects = screen.getAllByRole("combobox");
  const route = selects.find((select) => within(select).queryByRole("option", { name: "Town route" }));
  const van = selects.find((select) => [...select.options].some((option) => option.value === "4"));
  expect(route).toBeTruthy();
  expect(van).toBeTruthy();
  fireEvent.change(route, { target: { value: "3" } });
  fireEvent.change(van, { target: { value: "4" } });
  const save = screen.getByRole("button", { name: "For Delivery" });
  await waitFor(() => expect(save).toBeEnabled());
  expect(api.post).not.toHaveBeenCalled();
  expect(api.patch).not.toHaveBeenCalled();
  fireEvent.click(save);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith("mobile-orders/van-load/dispatch/", expect.objectContaining({
    order_numbers: mockBatch.order_numbers,
    status: "Pending", warehouse: 1, route: 3, van: 4,
    items: [expect.objectContaining({ product: 75, dispatched_pcs: 6, actual_return_pcs: 0, actual_sale: 0 })],
  }), { params: { warehouse: 1 } }));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/trading"));
  expect(api.post.mock.calls.some(([url]) => url.includes("bulk-adjust"))).toBe(false);
});
