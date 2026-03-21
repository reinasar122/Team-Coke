// src/components/merchandisingcomponents/ActionButtons.jsx
import React from "react";

const ActionButtons = ({
  transactionType,
  onBack,
  onFinalize,
  onPay,
  onCancel,
  finalizeDisabled,
  warehouseActionLabel = "Pay",
  warehouseActionDisabled = false,
  showWarehouseAction = true,
  showCancel = false,
  hideBack = false,
}) => {
  return (
    <div className="flex justify-end gap-4 mt-6">
      {!hideBack && (
        <button onClick={onBack} className="bg-gray-500 text-white px-4 py-2 rounded">
          Back
        </button>
      )}

      {transactionType === "Van Load" && (
        <button
          onClick={onFinalize}
          disabled={!!finalizeDisabled}
          className={`px-4 py-2 rounded text-white ${
            finalizeDisabled ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
          title={finalizeDisabled ? "No dispatched items to deduct" : "Finalize Sale"}
        >
          For Delivery
        </button>
      )}

      {transactionType === "Warehouse" && showCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
        >
          Cancel
        </button>
      )}

      {transactionType === "Warehouse" && showWarehouseAction && (
        <button
          onClick={onPay}
          disabled={warehouseActionDisabled}
          className={`px-4 py-2 rounded text-white ${
            warehouseActionDisabled
              ? "bg-gray-400 cursor-not-allowed"
              : warehouseActionLabel === "Reserved"
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {warehouseActionLabel}
        </button>
      )}
    </div>
  );
};

export default ActionButtons;