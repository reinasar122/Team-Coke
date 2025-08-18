// src/components/merchandisingcomponents/ActionButtons.jsx
import React from "react";

const ActionButtons = ({ transactionType, onBack, onFinalize, onPay, finalizeDisabled }) => {
  return (
    <div className="flex justify-end gap-4 mt-6 max-w-7xl mx-auto">
      <button onClick={onBack} className="bg-gray-500 text-white px-4 py-2 rounded">
        Back
      </button>

      {transactionType === "Van Load" && (
        <button
          onClick={onFinalize}
          disabled={!!finalizeDisabled}
          className={`px-4 py-2 rounded text-white ${
            finalizeDisabled ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
          title={finalizeDisabled ? "No dispatched items to deduct" : "Finalize Sale"}
        >
          Finalize Sale
        </button>
      )}

      {transactionType === "Warehouse" && (
        <button onClick={onPay} className="bg-green-600 text-white px-4 py-2 rounded">
          Pay
        </button>
      )}
    </div>
  );
};

export default ActionButtons;
