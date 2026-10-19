import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import VanLoadReturnRemittance from "./VanLoadReturnRemittance";
import api from "../api";

const mockNavigate = jest.fn();
const mockNotify = jest.fn();
const mockLocation = { state: { id: 91 } };
jest.mock("react-router-dom", () => ({ useLocation: () => mockLocation, useNavigate: () => mockNavigate }), { virtual: true });
jest.mock("../api", () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));
jest.mock("../contexts/NotificationContext", () => ({ useNotifications: () => ({ addNotification: mockNotify }) }));
jest.mock("../components/merchandisingcomponents/ExpensesSection", () => () => null);
jest.mock("../components/PaymentModal", () => ({ onPaymentSuccess }) => <button onClick={() => onPaymentSuccess({ paymentMethod: "cash", amount: 40, cashReceived: 40 }).catch(() => {})}>Submit declaration</button>);

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("user", JSON.stringify({ role: "cashier", warehouse_id: 1 }));
  api.get.mockImplementation((path) => Promise.resolve({ data: path === '/unit-types/' ? [{ id: 1, content_no: 24 }] : path.includes('mobile-van-loads') ? {
    id: 'batch-1', outcomes: {}, orders: [
      { order_number: 'WA-1', number: 'MO-0001', customer: 'Customer A', quantities: { '75': 4 } },
      { order_number: 'WA-2', number: 'MO-0002', customer: 'Customer B', quantities: { '75': 2 } },
    ],
  } : {
    id: 91, msp_no: 'VL-001', warehouse: 1, transaction_type_name: 'Van Load', mobile_van_load_batch_id: 'batch-1',
    items: [{ id: 1, product_detail: { id: 75, product_name: 'Coke', unit_type: { id: 1 } }, dispatched_pcs: 6,
      dispatched_shell: 0, sold_pcs: 4, sold_shell: 0, actual_return_pcs: 2, actual_return_shell: 0,
      selling_price: '10.00', empty_price_pc: 0, empty_price_shell: 0, empty_return_pcs: 0, empty_return_shell: 0 }],
  } }));
  api.post.mockResolvedValue({ data: { sale_id: 91 } });
  api.patch.mockResolvedValue({ data: { id: 91, status: 'Complete' } });
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  document.querySelectorAll('body > .fixed').forEach((element) => element.remove());
});

test('customer refusal is declared per order and submitted with products and quantities before van completion', async () => {
  render(<VanLoadReturnRemittance />);
  const accepted = await screen.findByLabelText('MO-0001 · Customer A');
  const refused = screen.getByLabelText('MO-0002 · Customer B');
  fireEvent.click(screen.getByRole('button', { name: 'Remittance' }));
  expect(screen.queryByRole('button', { name: 'Submit declaration' })).not.toBeInTheDocument();
  fireEvent.change(accepted, { target: { value: 'DELIVERED' } });
  fireEvent.change(refused, { target: { value: 'RETURNED' } });
  fireEvent.click(screen.getByRole('button', { name: 'Remittance' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Submit declaration' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/mobile-van-loads/batch-1/return/', expect.objectContaining({
    order_outcomes: { 'WA-1': 'DELIVERED', 'WA-2': 'RETURNED' },
    products: [expect.objectContaining({ productId: 75, sold_pcs: 4, actual_return_pcs: 2 })],
  }), { params: { warehouse: 1 } }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/merchandising-set/91/', expect.objectContaining({ status: 'Complete' })));
  expect(api.post.mock.invocationCallOrder[0]).toBeLessThan(api.patch.mock.invocationCallOrder[0]);
});
