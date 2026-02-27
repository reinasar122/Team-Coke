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
    <div className="w-full px-10 py-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <FaCog className="text-3xl text-gray-800 dark:text-white" />
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          Stock Threshold Settings
        </h1>
      </div>

      <div className="bg-white dark:bg-gray-800 p-10 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
        {/* Description */}
        <div className="mb-10">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
            Configure Stock Levels
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            These thresholds control how stock levels are classified in the
            inventory.
          </p>
        </div>

        <div className="grid xl:grid-cols-4 gap-8">
          {/* Threshold Cards */}
          <div className="xl:col-span-3 grid lg:grid-cols-3 gap-6">
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
          <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 border dark:border-gray-600">
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
        <div className="flex justify-between items-center mt-12">
          <button
            onClick={resetToDefaults}
            className="px-6 py-2 rounded-xl border border-gray-400 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            Reset to Defaults
          </button>

          <button
            onClick={saveStockThresholds}
            disabled={!isDirty || saving}
            className={`px-4 py-2 rounded-xl font-bold text-lg text-white transition-all
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

  return (
    <div
      className={`p-6 rounded-2xl border-2 transition-all hover:scale-[1.02] hover:shadow-lg
        border-${color}-200 dark:border-${color}-800 bg-${color}-50 dark:bg-${color}-900/20`}
    >
      <div className={`flex items-center gap-2 text-${color}-600 mb-3`}>
        {icon}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>

      <input
        type="number"
        name={name}
        value={value}
        onChange={onChange}
        className="w-full p-4 text-lg font-semibold rounded-xl border bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-1"
      />

      <div className="mt-4 h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full">
        <div
          className={`h-2 rounded-full bg-${color}-500 transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default Settings;