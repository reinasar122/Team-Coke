import { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import {
  FaCog,
  FaExclamationTriangle,
  FaCubes,
  FaCheckCircle,
} from "react-icons/fa";
import { getStockThresholds } from "../utils/stockThresholds";

const DEFAULT_THRESHOLDS = {
  low_threshold: 10,
  moderate_threshold: 50,
  high_threshold: 100,
};

const THRESHOLD_CARD_THEMES = {
  red: {
    card: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20",
    text: "text-red-600 dark:text-red-400",
    bar: "#ef4444",
  },
  yellow: {
    card: "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20",
    text: "text-yellow-600 dark:text-yellow-400",
    bar: "#eab308",
  },
  green: {
    card: "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20",
    text: "text-green-600 dark:text-green-400",
    bar: "#22c55e",
  },
};

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
    <div className="min-h-full w-full bg-gray-50 px-4 py-6 dark:bg-gray-900 sm:px-6 sm:py-8 lg:px-10">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center">
        <FaCog className="text-3xl text-gray-800 dark:text-white" />
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          Stock Threshold Settings
        </h1>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800 sm:p-6 lg:p-10">
        {/* Description */}
        <div className="mb-8 lg:mb-10">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
            Configure Stock Levels
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            These thresholds control how stock levels are classified in the
            inventory.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:gap-6 xl:grid-cols-4 xl:gap-8">
          {/* Threshold Cards */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3 xl:col-span-3">
            {/* LOW */}
            <ThresholdCard
              title="Low Stock"
              color="red"
              icon={<FaExclamationTriangle />}
              name="low_threshold"
              value={stockThresholds.low_threshold}
              onChange={handleThresholdChange}
              max={stockThresholds.high_threshold}
            />

            {/* MODERATE */}
            <ThresholdCard
              title="Moderate Stock"
              color="yellow"
              icon={<FaCubes />}
              name="moderate_threshold"
              value={stockThresholds.moderate_threshold}
              max={stockThresholds.high_threshold}
              onChange={handleThresholdChange}
            />

            {/* HIGH */}
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

          {/* Preview */}
          <div className="rounded-2xl border p-5 dark:border-gray-600 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 sm:p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">
              Preview
            </h3>
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <p>🔴 Low: 1 – {stockThresholds.low_threshold}</p>
              <p>
                🟡 Moderate: {stockThresholds.low_threshold + 1} –{" "}
                {stockThresholds.moderate_threshold}
              </p>
              <p>
                🟢 High: {stockThresholds.moderate_threshold + 1} –{" "}
                {stockThresholds.high_threshold}
              </p>
              <p>🚀 Very High: &gt; {stockThresholds.high_threshold}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-10 flex flex-col-reverse gap-3 sm:mt-12 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={resetToDefaults}
            className="w-full rounded-xl border border-gray-400 px-6 py-2 text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 sm:w-auto"
          >
            Reset to Defaults
          </button>

          <button
            onClick={saveStockThresholds}
            disabled={!isDirty || saving}
            className={`w-full rounded-xl px-4 py-2 text-lg font-bold text-white transition-all sm:w-auto
              ${
                !isDirty || saving
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl"
              }`}
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>

        {/* Info */}
        <div className="mt-10 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 rounded">
          <h4 className="font-semibold mb-2">ℹ How it works</h4>
          <ul className="text-sm space-y-1">
            <li>• Controls inventory stock status colors</li>
            <li>• Low stock triggers alerts</li>
            <li>• Stored locally for now</li>
            <li>• Applies instantly</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ===================== */
/* Reusable Card */
/* ===================== */
function ThresholdCard({
  title,
  icon,
  color,
  name,
  value,
  onChange,
  max,
}) {
  const percentage =
    max && value !== "" ? Math.min((value / max) * 100, 100) : 0;
  const theme = THRESHOLD_CARD_THEMES[color] || THRESHOLD_CARD_THEMES.red;

  return (
    <div
      className={`rounded-2xl border-2 p-5 transition-all hover:shadow-lg sm:p-6 ${theme.card}`}
    >
      <div className={`mb-3 flex items-center gap-2 ${theme.text}`}>
        {icon}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>

      <input
        type="number"
        name={name}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border bg-white p-4 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-offset-1 dark:bg-gray-900 sm:text-lg"
      />

      <div className="mt-4 h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${percentage}%`, backgroundColor: theme.bar }}
        />
      </div>
    </div>
  );
}

export default Settings;
