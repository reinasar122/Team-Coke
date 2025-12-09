import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { FaCog, FaExclamationTriangle, FaCubes, FaCheckCircle } from "react-icons/fa";
import { getStockThresholds } from "../utils/stockThresholds"; // Import the utils

function Settings() {
  const [stockThresholds, setStockThresholds] = useState({
    low_threshold: 10,
    moderate_threshold: 50,
    high_threshold: 100,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStockThresholds();
  }, []);

  const fetchStockThresholds = async () => {
    setLoading(true);
    try {
      // Use the utils function to get saved thresholds
      const savedThresholds = getStockThresholds();
      setStockThresholds(savedThresholds);
    } catch (error) {
      console.error("Error loading thresholds:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleThresholdChange = (e) => {
    const { name, value } = e.target;
    // Allow empty value while typing, convert to number when valid
    const numValue = value === '' ? '' : parseInt(value);
    setStockThresholds({ 
      ...stockThresholds, 
      [name]: numValue
    });
  };

  const saveStockThresholds = async () => {
    // Validation - check if all values are numbers and not empty
    const { low_threshold, moderate_threshold, high_threshold } = stockThresholds;
    
    if (low_threshold === '' || moderate_threshold === '' || high_threshold === '') {
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
      // Save to localStorage (since API endpoint doesn't exist yet)
      localStorage.setItem("stockThresholds", JSON.stringify(stockThresholds));
      
      toast.success("Stock thresholds updated successfully!");
      
      // Dispatch event to refresh stocks if needed
      window.dispatchEvent(new CustomEvent('stockThresholdsChanged', { 
        detail: stockThresholds 
      }));
      
    } catch (error) {
      toast.error("Failed to save thresholds");
      console.error("Save error:", error);
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setStockThresholds({
      low_threshold: 10,
      moderate_threshold: 50,
      high_threshold: 100,
    });
    toast.info("Thresholds reset to default values");
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-300">Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <FaCog className="text-3xl text-gray-800 dark:text-white" />
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Stock Threshold Settings</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
            Configure Stock Level Thresholds
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Set the quantity thresholds that determine when products are considered Low, Moderate, or High stock.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Low Threshold */}
          <div className="p-6 border-2 border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
            <div className="flex items-center mb-3">
              <FaExclamationTriangle className="text-red-600 mr-2" />
              <h3 className="text-lg font-semibold text-red-700 dark:text-red-300">Low Stock</h3>
            </div>
            <p className="text-sm text-red-600 dark:text-red-400 mb-3">
              Products with quantity ≤ this value will be marked as "Low Stock"
            </p>
            <div>
              <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                Low Threshold
              </label>
              <input
                type="number"
                name="low_threshold"
                value={stockThresholds.low_threshold}
                onChange={handleThresholdChange}
                min="1"
                className="w-full p-3 border border-red-300 dark:border-red-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter low threshold"
              />
            </div>
          </div>

          {/* Moderate Threshold */}
          <div className="p-6 border-2 border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
            <div className="flex items-center mb-3">
              <FaCubes className="text-yellow-600 mr-2" />
              <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">Moderate Stock</h3>
            </div>
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-3">
              Products with quantity between Low and High thresholds
            </p>
            <div>
              <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-2">
                Moderate Threshold
              </label>
              <input
                type="number"
                name="moderate_threshold"
                value={stockThresholds.moderate_threshold}
                onChange={handleThresholdChange}
                min="1"
                className="w-full p-3 border border-yellow-300 dark:border-yellow-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter moderate threshold"
              />
            </div>
          </div>

          {/* High Threshold */}
          <div className="p-6 border-2 border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-900/20">
            <div className="flex items-center mb-3">
              <FaCheckCircle className="text-green-600 mr-2" />
              <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">High Stock</h3>
            </div>
            <p className="text-sm text-green-600 dark:text-green-400 mb-3">
              Products with quantity ≥ this value will be marked as "High Stock"
            </p>
            <div>
              <label className="block text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                High Threshold
              </label>
              <input
                type="number"
                name="high_threshold"
                value={stockThresholds.high_threshold}
                onChange={handleThresholdChange}
                min="1"
                className="w-full p-3 border border-green-300 dark:border-green-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter high threshold"
              />
            </div>
          </div>
        </div>

        {/* Preview Section */}
        {stockThresholds.low_threshold !== '' && stockThresholds.moderate_threshold !== '' && stockThresholds.high_threshold !== '' && (
          <div className="mb-8 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">Current Settings Preview:</h3>
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <p><strong>Out of Stock:</strong> Quantity = 0</p>
              <p><strong>Low Stock:</strong> Quantity = 1 to {stockThresholds.low_threshold}</p>
              <p><strong>Moderate Stock:</strong> Quantity = {Number(stockThresholds.low_threshold) + 1} to {stockThresholds.moderate_threshold}</p>
              <p><strong>High Stock:</strong> Quantity = {Number(stockThresholds.moderate_threshold) + 1} to {stockThresholds.high_threshold}</p>
              <p><strong>Very High Stock:</strong> Quantity &gt; {stockThresholds.high_threshold}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={resetToDefaults}
            className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors duration-200"
          >
            Reset to Defaults
          </button>

          <div className="space-x-3">
            <button
              onClick={saveStockThresholds}
              disabled={saving}
              className={`px-8 py-3 rounded-lg text-white font-semibold transition-all duration-200 ${
                saving 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md'
              }`}
            >
              {saving ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </span>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-600">
          <h4 className="text-blue-800 dark:text-blue-300 font-semibold mb-2">📝 How it works:</h4>
          <ul className="text-blue-700 dark:text-blue-300 text-sm space-y-1">
            <li>• These thresholds determine the color-coding and status of products in your stock table</li>
            <li>• Low stock items will trigger notifications to help you reorder in time</li>
            <li>• Settings are saved locally and applied to all warehouses</li>
            <li>• Changes take effect immediately on your stock displays</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Settings;