import { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import {
  FaCog,
  FaExclamationTriangle,
  FaCubes,
  FaCheckCircle,
  FaEdit,
  FaTrash,
} from "react-icons/fa";
import api from "../api";
import { getStockThresholds } from "../utils/stockThresholds";
import "../styles/pages/settings.scss";

const DEFAULT_THRESHOLDS = {
  low_threshold: 10,
  moderate_threshold: 50,
  high_threshold: 100,
};

const THRESHOLD_CARD_THEMES = {
  red: {
    cardClass: "settings-page__threshold-card--red",
    titleClass: "settings-page__threshold-card-title--red",
    fillClass: "settings-page__threshold-card-fill--red",
  },
  yellow: {
    cardClass: "settings-page__threshold-card--yellow",
    titleClass: "settings-page__threshold-card-title--yellow",
    fillClass: "settings-page__threshold-card-fill--yellow",
  },
  green: {
    cardClass: "settings-page__threshold-card--green",
    titleClass: "settings-page__threshold-card-title--green",
    fillClass: "settings-page__threshold-card-fill--green",
  },
};

function ThresholdCard({ title, color, icon, name, value, onChange, max }) {
  const theme = THRESHOLD_CARD_THEMES[color] || THRESHOLD_CARD_THEMES.red;
  const safeMax = Number(max) > 0 ? Number(max) : 1;
  const progress = Math.min((Number(value) || 0) / safeMax, 1) * 100;

  return (
    <div className={`settings-page__threshold-card ${theme.cardClass}`}>
      <div className={`settings-page__threshold-card-title ${theme.titleClass}`}>
        <span className="settings-page__threshold-card-title-icon">{icon}</span>
        <span>{title}</span>
      </div>

      <input
        type="number"
        min="0"
        max={max}
        name={name}
        value={value}
        onChange={onChange}
        className="settings-page__threshold-card-input"
      />

      <div className="settings-page__threshold-card-track">
        <div
          className={`settings-page__threshold-card-fill ${theme.fillClass}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function Settings() {
  const [stockThresholds, setStockThresholds] = useState(DEFAULT_THRESHOLDS);
  const [initialThresholds, setInitialThresholds] = useState(DEFAULT_THRESHOLDS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deliveryFees, setDeliveryFees] = useState([]);
  const [deliveryFeesLoading, setDeliveryFeesLoading] = useState(false);
  const [deliveryFeeSaving, setDeliveryFeeSaving] = useState(false);
  const [deliveryFeeAddress, setDeliveryFeeAddress] = useState("");
  const [deliveryFeeAmount, setDeliveryFeeAmount] = useState("");
  const [editingDeliveryFeeId, setEditingDeliveryFeeId] = useState(null);
  const [feeToDelete, setFeeToDelete] = useState(null);

  const getWarehouseId = () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const selected = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
      return selected?.id || user.warehouse_id || null;
    } catch (error) {
      console.error("Unable to read the selected warehouse:", error);
      return null;
    }
  };

  const fetchDeliveryFees = async () => {
    const warehouseId = getWarehouseId();
    if (!warehouseId) {
      setDeliveryFees([]);
      return;
    }
    setDeliveryFeesLoading(true);
    try {
      const response = await api.get("/delivery-fees/", { params: { warehouse: warehouseId } });
      setDeliveryFees(response.data || []);
    } catch (error) {
      console.error("Error loading delivery fees:", error);
      toast.error(error.response?.data?.detail || "Failed to load delivery fees.");
    } finally {
      setDeliveryFeesLoading(false);
    }
  };

  useEffect(() => {
    fetchStockThresholds();
    fetchDeliveryFees();
  }, []);

  const fetchStockThresholds = async () => {
    setLoading(true);
    try {
      const saved = getStockThresholds();
      setStockThresholds(saved);
      setInitialThresholds(saved);
    } catch (error) {
      console.error("Error loading thresholds:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleThresholdChange = (e) => {
    const { name, value } = e.target;
    setStockThresholds((prev) => ({
      ...prev,
      [name]: value === "" ? "" : Number(value),
    }));
  };

  const isDirty = useMemo(
    () =>
      JSON.stringify(stockThresholds) !==
      JSON.stringify(initialThresholds),
    [stockThresholds, initialThresholds]
  );

  const saveStockThresholds = async () => {
    const { low_threshold, moderate_threshold, high_threshold } =
      stockThresholds;

    if (
      low_threshold === "" ||
      moderate_threshold === "" ||
      high_threshold === ""
    ) {
      toast.error("All threshold values must be filled");
      return;
    }

    if (low_threshold >= moderate_threshold) {
      toast.error("Low threshold must be less than moderate threshold");
      return;
    }

    if (moderate_threshold >= high_threshold) {
      toast.error("Moderate threshold must be less than high threshold");
      return;
    }

    if (low_threshold < 0 || moderate_threshold < 0 || high_threshold < 0) {
      toast.error("Thresholds cannot be negative");
      return;
    }

    setSaving(true);
    try {
      localStorage.setItem(
        "stockThresholds",
        JSON.stringify(stockThresholds)
      );

      setInitialThresholds(stockThresholds);

      window.dispatchEvent(
        new CustomEvent("stockThresholdsChanged", {
          detail: stockThresholds,
        })
      );

      toast.success("Stock thresholds updated successfully!");
    } catch (error) {
      toast.error("Failed to save thresholds");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setStockThresholds(DEFAULT_THRESHOLDS);
    toast.info("Thresholds reset to default values");
  };

  const clearDeliveryFeeForm = () => {
    setEditingDeliveryFeeId(null);
    setDeliveryFeeAddress("");
    setDeliveryFeeAmount("");
  };

  const saveDeliveryFee = async (event) => {
    event.preventDefault();
    const address = deliveryFeeAddress.trim().replace(/\s+/g, " ");
    const amount = Number(deliveryFeeAmount);
    if (!address || !Number.isFinite(amount) || amount < 0) {
      toast.error("Enter an address and a delivery fee of zero or more.");
      return;
    }
    const warehouseId = getWarehouseId();
    if (!warehouseId) {
      toast.error("Select a warehouse before managing delivery fees.");
      return;
    }
    setDeliveryFeeSaving(true);
    try {
      const payload = { address, delivery_fee: amount.toFixed(2) };
      if (editingDeliveryFeeId) {
        await api.patch(`/delivery-fees/${editingDeliveryFeeId}/`, payload, {
          params: { warehouse: warehouseId },
        });
        toast.success("Delivery fee updated.");
      } else {
        await api.post("/delivery-fees/", payload, { params: { warehouse: warehouseId } });
        toast.success("Delivery fee added.");
      }
      clearDeliveryFeeForm();
      await fetchDeliveryFees();
    } catch (error) {
      console.error("Error saving delivery fee:", error);
      toast.error(error.response?.data?.address?.[0] || error.response?.data?.detail || "Failed to save delivery fee.");
    } finally {
      setDeliveryFeeSaving(false);
    }
  };

  const editDeliveryFee = (fee) => {
    setEditingDeliveryFeeId(fee.id);
    setDeliveryFeeAddress(fee.address);
    setDeliveryFeeAmount(String(fee.delivery_fee));
  };

  const deleteDeliveryFee = async (fee) => {
    const warehouseId = getWarehouseId();
    setDeliveryFeeSaving(true);
    try {
      await api.delete(`/delivery-fees/${fee.id}/`, { params: { warehouse: warehouseId } });
      if (editingDeliveryFeeId === fee.id) clearDeliveryFeeForm();
      setFeeToDelete(null);
      toast.success("Delivery fee removed.");
      await fetchDeliveryFees();
    } catch (error) {
      console.error("Error deleting delivery fee:", error);
      toast.error(error.response?.data?.detail || "Failed to remove delivery fee.");
    } finally {
      setDeliveryFeeSaving(false);
    }
  };

  const previewItems = [
    {
      label: "Low",
      range: `1 - ${stockThresholds.low_threshold}`,
      tone: "red",
    },
    {
      label: "Moderate",
      range: `${stockThresholds.low_threshold + 1} - ${stockThresholds.moderate_threshold}`,
      tone: "yellow",
    },
    {
      label: "High",
      range: `${stockThresholds.moderate_threshold + 1} - ${stockThresholds.high_threshold}`,
      tone: "green",
    },
    {
      label: "Very High",
      range: `> ${stockThresholds.high_threshold}`,
      tone: "violet",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          <span className="text-gray-600 dark:text-gray-300">
            Loading settings...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="page settings-page">
      <div className="page-header settings-page__header">
        <h1 className="page-title settings-page__title">
          <FaCog className="settings-page__title-icon" />
          <span>Settings</span>
        </h1>
      </div>

      <div className="settings-page__content settings-page__shell">
        <div className="settings-page__intro">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
            Stock Threshold Settings
          </h2>
          <p className="mt-1 text-gray-600 dark:text-gray-300">
            These thresholds control how stock levels are classified in the
            inventory.
          </p>
        </div>

        <div className="settings-page__layout">
          <div className="settings-page__thresholds">
            <ThresholdCard
              title="Low Stock"
              color="red"
              icon={<FaExclamationTriangle />}
              name="low_threshold"
              value={stockThresholds.low_threshold}
              onChange={handleThresholdChange}
              max={stockThresholds.high_threshold}
            />

            <ThresholdCard
              title="Moderate Stock"
              color="yellow"
              icon={<FaCubes />}
              name="moderate_threshold"
              value={stockThresholds.moderate_threshold}
              max={stockThresholds.high_threshold}
              onChange={handleThresholdChange}
            />

            <ThresholdCard
              title="High Stock"
              color="green"
              icon={<FaCheckCircle />}
              name="high_threshold"
              value={stockThresholds.high_threshold}
              max={stockThresholds.high_threshold}
              onChange={handleThresholdChange}
            />
          </div>

          <div className="settings-page__preview">
            <h3 className="settings-page__preview-title">Preview</h3>
            <div className="settings-page__preview-list">
              {previewItems.map((item) => (
                <div key={item.label} className="settings-page__preview-item">
                  <span
                    className={`settings-page__preview-dot settings-page__preview-dot--${item.tone}`}
                  />
                  <span>
                    {item.label}: <span className="settings-page__preview-value">{item.range}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="settings-page__actions">
          <button
            onClick={resetToDefaults}
            className="settings-page__secondary-btn"
          >
            Reset to Defaults
          </button>

          <button
            onClick={saveStockThresholds}
            disabled={!isDirty || saving}
            className={`settings-page__primary-btn
              ${
                !isDirty || saving
                  ? "cursor-not-allowed bg-gray-600"
                  : "bg-gradient-to-r from-blue-600 to-blue-700 shadow-md hover:from-blue-700 hover:to-blue-800 hover:shadow-lg"
              }`}
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>

        <section className="settings-page__delivery-fees" aria-labelledby="delivery-fees-heading">
          <div className="settings-page__delivery-fees-heading">
            <div>
              <h3 id="delivery-fees-heading">Van Load Delivery Fees</h3>
              <p>Configure a fee for each delivery address or route. Mobile delivery groups charge per order and regular van loads charge once per transaction.</p>
            </div>
          </div>
          <form className="settings-page__delivery-fee-form" onSubmit={saveDeliveryFee}>
            <label>
              Address / route
              <input
                value={deliveryFeeAddress}
                onChange={(event) => setDeliveryFeeAddress(event.target.value)}
                maxLength={255}
                required
                placeholder="Enter delivery address or route name"
                disabled={deliveryFeeSaving}
              />
            </label>
            <label>
              Delivery fee (₱)
              <input
                type="number"
                min="0"
                step="0.01"
                value={deliveryFeeAmount}
                onChange={(event) => setDeliveryFeeAmount(event.target.value)}
                required
                placeholder="0.00"
                disabled={deliveryFeeSaving}
              />
            </label>
            <div className="settings-page__delivery-fee-actions">
              <button type="submit" disabled={deliveryFeeSaving}>
                {deliveryFeeSaving ? "Saving..." : editingDeliveryFeeId ? "Update Fee" : "Add Fee"}
              </button>
              {editingDeliveryFeeId && (
                <button type="button" disabled={deliveryFeeSaving} onClick={clearDeliveryFeeForm}>Cancel</button>
              )}
            </div>
          </form>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Address / Route</th><th>Delivery Fee</th><th>Actions</th></tr></thead>
              <tbody>
                {deliveryFeesLoading ? (
                  <tr><td colSpan={3}>Loading delivery fees...</td></tr>
                ) : deliveryFees.length === 0 ? (
                  <tr><td colSpan={3}>No delivery fees configured.</td></tr>
                ) : deliveryFees.map((fee) => (
                  <tr key={fee.id}>
                    <td>{fee.address}</td>
                    <td>₱{Number(fee.delivery_fee).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>
                      <div className="settings-page__delivery-fee-row-actions">
                        <button
                          type="button" disabled={deliveryFeeSaving} onClick={() => editDeliveryFee(fee)} >
                          <FaEdit aria-hidden="true" />
                        </button>
                        <button
                          type="button" disabled={deliveryFeeSaving} onClick={() => setFeeToDelete(fee)}>
                          <FaTrash aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {feeToDelete && (
          <div
            className="app-modal-overlay"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-delivery-fee-title"
            aria-describedby="delete-delivery-fee-description"
            onClick={() => !deliveryFeeSaving && setFeeToDelete(null)}
          >
            <div
              className="app-modal-panel app-modal-panel-sm p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="delete-delivery-fee-title" className="mb-3 text-lg font-semibold">
                Remove delivery fee?
              </h3>
              <p id="delete-delivery-fee-description" className="mb-6">
                Are you sure you want to remove the fee for {feeToDelete.address}?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn btn-cancel"
                  disabled={deliveryFeeSaving}
                  onClick={() => setFeeToDelete(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={deliveryFeeSaving}
                  onClick={() => deleteDeliveryFee(feeToDelete)}
                >
                  {deliveryFeeSaving ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="settings-page__info">
          <h4 className="settings-page__info-title">How it works</h4>
          <ul className="space-y-1 text-sm">
            <li>Controls inventory stock status colors</li>
            <li>Low stock triggers alerts</li>
            <li>Stored locally for now</li>
            <li>Applies instantly</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Settings;
