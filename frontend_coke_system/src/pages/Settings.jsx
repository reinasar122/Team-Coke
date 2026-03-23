import { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import {
  FaCog,
  FaExclamationTriangle,
  FaCubes,
  FaCheckCircle,
} from "react-icons/fa";
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

  useEffect(() => {
    fetchStockThresholds();
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
                  ? "cursor-not-allowed bg-gray-400"
                  : "bg-gradient-to-r from-blue-600 to-blue-700 shadow-md hover:from-blue-700 hover:to-blue-800 hover:shadow-lg"
              }`}
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>

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
