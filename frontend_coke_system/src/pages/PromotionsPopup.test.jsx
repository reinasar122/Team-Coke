import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import PromotionsPopup from "./PromotionsPopup";
import MobilePromotions from "../components/MobilePromotions";
import api from "../api";

jest.mock("../api", () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));
const offer = { id: 9, title: "12.5% Off", status: "Active", promotion_type: "occasional-discount",
  discount_percent: "12.50", products: [{ id: 6, product_name: "Yakult" }],
  start_date: "2026-10-17", end_date: "2026-10-20" };

beforeEach(() => {
  jest.clearAllMocks();
  HTMLDialogElement.prototype.showModal = jest.fn(function () { this.setAttribute("open", ""); });
  HTMLDialogElement.prototype.close = jest.fn(function () { this.removeAttribute("open"); });
  api.get.mockResolvedValue({ data: [{ id: 6, product_name: "Yakult" }] });
});

const fillForm = async () => {
  fireEvent.change(screen.getByLabelText("Promotion Type"), { target: { value: "occasional-discount" } });
  fireEvent.change(screen.getByLabelText("Discount (%)"), { target: { value: "12.50" } });
  fireEvent.click(await screen.findByRole("checkbox", { name: "Yakult" }));
  fireEvent.change(screen.getByLabelText("Start Date"), { target: { value: "2026-10-17" } });
  fireEvent.change(screen.getByLabelText("End Date"), { target: { value: "2026-10-20" } });
};

test("saving persists the exact offer and selected products in the current warehouse", async () => {
  const onSaved = jest.fn();
  api.post.mockResolvedValue({ data: offer });
  render(<PromotionsPopup warehouseId={1} onSaved={onSaved} onClose={jest.fn()} />);
  await fillForm();
  expect(api.get).toHaveBeenCalledWith("products/", expect.objectContaining({ params: { warehouse_id: 1 } }));
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save Promotion" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith("promotions/", {
    promotion_type: "occasional-discount", discount_percent: "12.50", product_ids: [6],
    start_date: "2026-10-17", end_date: "2026-10-20",
  }, { params: { warehouse: 1 } }));
  expect(onSaved).toHaveBeenCalledWith(offer);
  expect(await screen.findByRole("status")).toHaveTextContent("Promotion saved.");
});

test("failed persistence preserves the selection and never claims success", async () => {
  const onSaved = jest.fn();
  api.post.mockRejectedValue({ response: { data: { detail: "You do not have permission." } } });
  render(<PromotionsPopup warehouseId={1} onSaved={onSaved} onClose={jest.fn()} />);
  await fillForm();
  fireEvent.click(screen.getByRole("button", { name: "Save Promotion" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission.");
  expect(screen.getByRole("checkbox", { name: "Yakult" })).toBeChecked();
  expect(onSaved).not.toHaveBeenCalled();
  expect(screen.queryByText(/Promotion saved/)).not.toBeInTheDocument();
});

test("editing an active promotion pre-fills its values and saves an update", async () => {
  api.patch.mockResolvedValue({ data: { ...offer, discount_percent: "15.00" } });
  render(<PromotionsPopup warehouseId={1} promotion={offer} onSaved={jest.fn()} onClose={jest.fn()} />);
  expect(await screen.findByLabelText("Promotion Type")).toHaveValue("occasional-discount");
  expect(screen.getByLabelText("Discount (%)")).toHaveValue(12.5);
  expect(await screen.findByRole("checkbox", { name: "Yakult" })).toBeChecked();
  fireEvent.change(screen.getByLabelText("Discount (%)"), { target: { value: "15" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith("promotions/9/", {
    promotion_type: "occasional-discount", discount_percent: "15", product_ids: [6],
    start_date: "2026-10-17", end_date: "2026-10-20",
  }, { params: { warehouse: 1 } }));
});

test("the promotion list refreshes saved offers and clears them when switching warehouses", async () => {
  api.get.mockResolvedValue({ data: [offer] });
  const { rerender } = render(<MobilePromotions warehouseId={1} refreshKey={0} />);
  expect(await screen.findByText("12.5% Off")).toBeInTheDocument();
  expect(screen.getByText("Yakult")).toBeInTheDocument();
  expect(screen.getByText("Active")).toBeInTheDocument();
  api.get.mockResolvedValue({ data: [] });
  rerender(<MobilePromotions warehouseId={2} refreshKey={1} />);
  expect(await screen.findByText(/No current or upcoming promotions/)).toBeInTheDocument();
  expect(screen.queryByText("12.5% Off")).not.toBeInTheDocument();
  expect(api.get).toHaveBeenLastCalledWith("promotions/", expect.objectContaining({ params: { warehouse: 2 } }));
});

test("expired promotions are hidden and clicking an active promotion opens edit", async () => {
  const onEdit = jest.fn();
  api.get.mockResolvedValue({ data: [
    offer,
    { ...offer, id: 10, title: "Expired", status: "Expired" },
  ] });
  render(<MobilePromotions warehouseId={1} refreshKey={0} onEdit={onEdit} />);
  expect(await screen.findByText("12.5% Off")).toBeInTheDocument();
  expect(screen.queryByText("Expired")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  const promotionCard = screen.getByRole("button", { name: "12.5% Off, edit promotion" });
  fireEvent.click(promotionCard);
  expect(onEdit).toHaveBeenCalledWith(offer);
  fireEvent.keyDown(promotionCard, { key: "Enter" });
  expect(onEdit).toHaveBeenCalledTimes(2);
});
