// ExpenseSettings.jsx - ENHANCED VERSION
import React, { useState, useEffect } from 'react';

const ExpenseSettings = () => {
  const [threshold, setThreshold] = useState(10000);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load saved threshold on mount
    const savedThreshold = localStorage.getItem('largeExpenseThreshold');
    if (savedThreshold) {
      setThreshold(Number(savedThreshold));
    }
  }, []);

  const handleThresholdChange = async (newThreshold) => {
    if (newThreshold < 0) {
      showAlert('Threshold cannot be negative', 'error');
      return;
    }

    setIsLoading(true);
    try {
      setThreshold(newThreshold);
      localStorage.setItem('largeExpenseThreshold', newThreshold.toString());
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('thresholdUpdated', { 
        detail: { newThreshold } 
      }));
      
      // Show success message
      showAlert('Large expense threshold updated successfully!', 'success');
      
    } catch (error) {
      console.error('Error updating threshold:', error);
      showAlert('Failed to update threshold', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Custom alert function
  const showAlert = (message, type = 'info') => {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'fixed top-4 right-4 z-50 animate-slideIn';
    const bgColor = type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500';
    alertDiv.innerHTML = `
      <div class="${bgColor} text-white p-4 rounded-lg shadow-lg flex items-center max-w-sm">
        <i class="fas ${type === 'error' ? 'fa-exclamation-triangle' : type === 'success' ? 'fa-check' : 'fa-info'} mr-3"></i>
        <span class="flex-1">${message}</span>
        <button class="ml-3 text-white hover:text-gray-200" onclick="this.closest('.animate-slideIn').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
    document.body.appendChild(alertDiv);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.remove();
      }
    }, 3000);
  };

  const presetThresholds = [5000, 10000, 15000, 25000, 50000];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">System Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Configure expense monitoring and notification preferences</p>
      </div>
      
      {/* Main Settings Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center mb-4">
          <div className="bg-red-100 dark:bg-red-900 p-2 rounded-lg mr-3">
            <i className="fas fa-dollar-sign text-red-600 dark:text-red-400 text-lg"></i>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Expense Notifications</h2>
        </div>
        
        <div className="expense-settings space-y-6">
          {/* Threshold Input Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Large Expense Alert Threshold
            </label>
            
            {/* Current Threshold Display */}
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Current threshold:</span>
                <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                  ₱{threshold.toLocaleString('en-PH')}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Expenses above this amount will trigger high-priority alerts
              </p>
            </div>

            {/* Preset Buttons */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quick Presets
              </label>
              <div className="flex flex-wrap gap-2">
                {presetThresholds.map(preset => (
                  <button
                    key={preset}
                    onClick={() => handleThresholdChange(preset)}
                    disabled={isLoading}
                    className={`px-3 py-2 text-sm rounded-md transition-colors ${
                      threshold === preset
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    ₱{preset.toLocaleString('en-PH')}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  onBlur={(e) => handleThresholdChange(Number(e.target.value))}
                  placeholder="Enter custom threshold amount"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  step="1000"
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={() => handleThresholdChange(threshold)}
                disabled={isLoading}
                className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Updating...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save mr-2"></i>
                    Update
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Alert Preview */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Alert Preview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Normal Expense */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <i className="fas fa-check-circle text-green-600 dark:text-green-400 mr-2"></i>
                  <span className="font-medium text-green-800 dark:text-green-200">Normal Expense</span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Expenses below ₱{threshold.toLocaleString('en-PH')} will show as regular notifications
                </p>
              </div>
              
              {/* Large Expense */}
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <i className="fas fa-exclamation-triangle text-red-600 dark:text-red-400 mr-2"></i>
                  <span className="font-medium text-red-800 dark:text-red-200">Large Expense Alert</span>
                </div>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Expenses ≥ ₱{threshold.toLocaleString('en-PH')} will trigger high-priority alerts 🚨
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Permissions Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
        <div className="flex items-start">
          <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded-lg mr-3 mt-0.5">
            <i className="fas fa-info-circle text-blue-600 dark:text-blue-400"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-blue-800 dark:text-blue-200 mb-2">
              Notification System Information
            </h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
              <li className="flex items-center">
                <i className="fas fa-check text-green-500 mr-2"></i>
                <strong>Admin & Supervisor:</strong> Receive all expense notifications and can configure settings
              </li>
              <li className="flex items-center">
                <i className="fas fa-bell text-yellow-500 mr-2"></i>
                <strong>Large Expense Alerts:</strong> High-priority notifications for expenses above threshold
              </li>
              <li className="flex items-center">
                <i className="fas fa-warehouse text-purple-500 mr-2"></i>
                <strong>Warehouse Filtering:</strong> Only see expenses from your assigned warehouse
              </li>
              <li className="flex items-center">
                <i className="fas fa-clock text-blue-500 mr-2"></i>
                <strong>Real-time Updates:</strong> Notifications appear immediately when expenses are added
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Back Button */}
      <div className="mt-6 flex justify-start">
        <button
          onClick={() => window.history.back()}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
        >
          <i className="fas fa-arrow-left mr-2"></i>
          Back to Expenses
        </button>
      </div>
    </div>
  );
};

export default ExpenseSettings;