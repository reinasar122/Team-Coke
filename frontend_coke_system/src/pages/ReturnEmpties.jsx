// src/pages/ReturnEmpties.jsx
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";

import "../styles/global.scss";
import "../styles/pages/returnempties.scss";

const ReturnEmpties = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [returnedEmpties, setReturnedEmpties] = useState([]);
  const [filteredEmpties, setFilteredEmpties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);

  const getCurrentWarehouse = useCallback(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");

    if (user.role?.toLowerCase() === "admin") {
      if (selectedWarehouse) {
        return { id: selectedWarehouse.id, name: selectedWarehouse.name };
      }
    }
    if (user.warehouse_id && user.warehouse) {
      return { id: user.warehouse_id, name: user.warehouse };
    }
    return null;
  }, []);

  useEffect(() => {
    const updateWarehouse = () => setCurrentWarehouse(getCurrentWarehouse());
    updateWarehouse();
    const handleWarehouseChange = () => updateWarehouse();
    window.addEventListener("warehouseChanged", handleWarehouseChange);
    return () => window.removeEventListener("warehouseChanged", handleWarehouseChange);
  }, [getCurrentWarehouse]);

  const fetchSuppliers = useCallback(async () => {
    if (!currentWarehouse) return;
    try {
      const { data } = await axios.get(
        `http://localhost:8080/api/suppliers/?warehouse=${currentWarehouse.id}`
      );
      let suppliersData = data?.results || data?.data || data;
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
    } catch (e) {
      console.error("Error fetching suppliers:", e);
      setError("Failed to load suppliers");
      setSuppliers([]);
    }
  }, [currentWarehouse]);

  const fetchProducts = useCallback(async () => {
    if (!currentWarehouse) return;
    try {
      const { data } = await axios.get(
        `http://localhost:8080/api/products/?warehouse=${currentWarehouse.id}`
      );
      let productsData = data?.results || data?.data || data;
      setProducts(Array.isArray(productsData) ? productsData : []);
    } catch (e) {
      console.error("Error fetching products:", e);
      setError("Failed to load products");
      setProducts([]);
    }
  }, [currentWarehouse]);

  const fetchPricing = useCallback(async () => {
    if (!currentWarehouse) return;
    try {
      const { data } = await axios.get(
        `http://localhost:8080/api/pricing/?warehouse=${currentWarehouse.id}`
      );
      let pricingData = data?.results || data?.data || data;
      setPricing(Array.isArray(pricingData) ? pricingData : []);
    } catch (e) {
      console.error("Error fetching pricing:", e);
      setError("Failed to load pricing data");
      setPricing([]);
    }
  }, [currentWarehouse]);

  const fetchReturnedEmptiesFromMerchandising = useCallback(async () => {
    if (!currentWarehouse) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.get(
        `http://localhost:8080/api/merchandisings/?warehouse=${currentWarehouse.id}`
      );
      let merchandisingData = data?.results || data?.data || data;

      const emptyReturns = [];

      if (Array.isArray(merchandisingData)) {
        merchandisingData.forEach((merchandising) => {
          if (
            (merchandising.transaction_type_name === "Warehouse" ||
              merchandising.transaction_type_name === "Van Load") &&
            merchandising.items
          ) {
            merchandising.items.forEach((item) => {
              const emptyShell = parseInt(item.empty_return_shell) || 0;
              const emptyPcs = parseInt(item.empty_return_pcs) || 0;

              if (emptyShell > 0 || emptyPcs > 0) {
                const productId = item.product;
                const product = products.find((p) => p.id === productId);
                if (product) {
                  const productPricing = pricing.find((p) => p.id === productId);
                  if (productPricing && (productPricing.shell_price > 0 || productPricing.bottle_price > 0)) {
                    const supplier = suppliers.find((s) => s.id === product.supplier);
                    emptyReturns.push({
                      id: `${merchandising.id}-${item.id}`,
                      msp_no: merchandising.msp_no,
                      product_name: product.product_name,
                      empty_return_shell: emptyShell,
                      empty_return_pcs: emptyPcs,
                      supplier_name: supplier ? supplier.company_name : "Unknown Supplier",
                      supplier_id: product.supplier,
                      product_id: productId,
                      date: merchandising.date_time ? merchandising.date_time.split("T")[0] : "N/A",
                      merchandising_id: merchandising.id,
                      item_id: item.id,
                      shell_price: productPricing.shell_price || 0,
                      bottle_price: productPricing.bottle_price || 0,
                      warehouse_id: currentWarehouse.id,
                      warehouse_name: currentWarehouse.name,
                      transaction_type: merchandising.transaction_type_name,
                    });
                  }
                }
              }
            });
          }
        });
      }

      const groupedReturns = {};
      emptyReturns.forEach((item) => {
        const key = item.product_id;
        if (groupedReturns[key]) {
          groupedReturns[key].empty_return_shell += item.empty_return_shell;
          groupedReturns[key].empty_return_pcs += item.empty_return_pcs;
          groupedReturns[key].msp_numbers.push(item.msp_no);
          groupedReturns[key].transaction_count += 1;
          if (!groupedReturns[key].transaction_types.includes(item.transaction_type)) {
            groupedReturns[key].transaction_types.push(item.transaction_type);
          }
          if (item.date > groupedReturns[key].date) {
            groupedReturns[key].date = item.date;
          }
        } else {
          groupedReturns[key] = {
            ...item,
            msp_numbers: [item.msp_no],
            transaction_count: 1,
            transaction_types: [item.transaction_type],
            id: `grouped-${key}`,
          };
        }
      });

      const aggregatedReturns = Object.values(groupedReturns);
      setReturnedEmpties(aggregatedReturns);
      setError(null);
    } catch (e) {
      console.error("Error fetching merchandising returns:", e);
      setError("Failed to load merchandising data");
      setReturnedEmpties([]);
    }
    setLoading(false);
  }, [products, suppliers, pricing, currentWarehouse]);

  useEffect(() => {
    if (currentWarehouse) {
      fetchSuppliers();
      fetchProducts();
      fetchPricing();
    }
  }, [currentWarehouse, fetchSuppliers, fetchProducts, fetchPricing]);

  useEffect(() => {
    if (currentWarehouse && suppliers.length > 0 && products.length > 0 && pricing.length > 0) {
      fetchReturnedEmptiesFromMerchandising();
    }
  }, [currentWarehouse, suppliers, products, pricing, fetchReturnedEmptiesFromMerchandising]);

  useEffect(() => {
    if (selectedSupplier) {
      const filtered = returnedEmpties.filter((item) =>
        item.supplier_name?.toLowerCase().includes(selectedSupplier.toLowerCase())
      );
      setFilteredEmpties(filtered);
    } else {
      setFilteredEmpties(returnedEmpties);
    }
  }, [selectedSupplier, returnedEmpties]);

  if (!currentWarehouse) {
    return (
      <div className="return-empties return-empties__no-warehouse">
        <div className="return-empties__no-warehouse-content">
          <h2>No Warehouse Selected</h2>
          <p>Please select a warehouse to view return empties.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="return-empties">
        <div className="return-empties__loading">Loading returned empties...</div>
      </div>
    );
  }

  return (
    <div className="return-empties">
      <div className="return-empties__container">
        {error && <div className="return-empties__error">{error}</div>}

        {/* (Optional) Warehouse info header — uses global tokens */}
        <div className="return-empties__warehouse-info">
          <h2>Warehouse: {currentWarehouse?.name}</h2>
          <p>Showing empty container returns aggregated by product</p>
        </div>

        {/* Filters */}
        <div className="return-empties__filters">
          <div className="return-empties__filters-row">
            <label className="return-empties__filters-label">Search:</label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="return-empties__filters-select"
            >
              <option value="">Filter by Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.company_name || s.name}>
                  {s.company_name || s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
      <div className="table-wrapper">
        <table className="table table-hover">
          <thead>
            <tr>
              <th className="text-left">Product</th>
              <th className="text-center">Total Empty Returns</th>
              <th className="text-left">Supplier</th>
              <th className="text-center">Transactions</th>
              <th className="text-center">Type</th>
              <th className="text-center">Latest Date</th>
            </tr>
          </thead>

          <tbody>
            {filteredEmpties.length > 0 ? (
              filteredEmpties.map((item) => (
                <tr key={item.id}>
                  <td className="text-left">
                    <div className="return-empties__product-name">{item.product_name}</div>
                    <div className="return-empties__product-prices">
                      {item.shell_price > 0 && (
                        <span className="return-empties__product-price-tag return-empties__product-price-tag--shell">
                          Shell: ₱{item.shell_price}
                        </span>
                      )}
                      {item.bottle_price > 0 && (
                        <span className="return-empties__product-price-tag return-empties__product-price-tag--bottle">
                          Bottle: ₱{item.bottle_price}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="text-center">
                    <div className="return-empties__returns-shell">{item.empty_return_shell} Shell</div>
                    <div className="return-empties__returns-pcs">{item.empty_return_pcs} PCs</div>
                  </td>

                  <td className="text-left">{item.supplier_name}</td>

                  <td className="text-center">
                    <span className="return-empties__transaction-count">
                      {item.transaction_count || 1}
                    </span>
                  </td>

                  <td className="text-center">
                    <div className="return-empties__transaction-types">
                      {(item.transaction_types || []).map((type, i) => (
                        <span
                          key={i}
                          className={
                            "return-empties__transaction-type " +
                            (type === "Van Load"
                              ? "return-empties__transaction-type--van-load"
                              : "return-empties__transaction-type--warehouse")
                          }
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="text-center">{item.date}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="return-empties__empty">No returned empties available</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


        {/* Summary */}
        {filteredEmpties.length > 0 && (
          <div className="return-empties__summary">
            <div className="return-empties__summary-grid">
              <div className="return-empties__summary-item">
                <span className="summary-label">Unique Products: </span>
                <span className="summary-value">{filteredEmpties.length}</span>
              </div>
              <div className="return-empties__summary-item">
                <span className="summary-label">Total Transactions: </span>
                <span className="summary-value">
                  {filteredEmpties.reduce((sum, i) => sum + (i.transaction_count || 1), 0)}
                </span>
              </div>
              <div className="return-empties__summary-item">
                <span className="summary-label">Total Shells: </span>
                <span className="summary-value">
                  {filteredEmpties.reduce((sum, i) => sum + i.empty_return_shell, 0)}
                </span>
              </div>
              <div className="return-empties__summary-item">
                <span className="summary-label">Total PCs: </span>
                <span className="summary-value">
                  {filteredEmpties.reduce((sum, i) => sum + i.empty_return_pcs, 0)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReturnEmpties;
