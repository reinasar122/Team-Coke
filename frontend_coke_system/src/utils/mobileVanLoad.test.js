import { mobileVanLoadRows } from "./mobileVanLoad";

test("prefill uses POS product IDs and package size with zero sold and returned quantities", () => {
  const rows = mobileVanLoadRows({ items: [{ product_id: 75, product_name: "Coke", quantity: 30 }] }, [{
    id: 75, product_name: "Coke", unit_type: { content_no: 24 }, price: { id: 3, selling_price: "10.00" },
  }]);
  expect(rows[0]).toMatchObject({ productId: 75, dispatchedPcs: 30, dispatchedShell: 1.25, soldPcs: 0, soldShell: 0, expectedReturnPcsEmpty: 0, expectedReturnPcsNonempty: 0, actualSale: 0 });
});

test("missing products block dispatch and missing packaging never invents a shell conversion", () => {
  const batch = { items: [{ product_id: 75, product_name: "Coke", quantity: 30 }] };
  expect(() => mobileVanLoadRows(batch, [])).toThrow("could not be loaded");
  expect(mobileVanLoadRows(batch, [{ id: 75, product_name: "Coke" }])[0]).toMatchObject({ dispatchedPcs: 30, dispatchedShell: "", contentNo: "" });
});
