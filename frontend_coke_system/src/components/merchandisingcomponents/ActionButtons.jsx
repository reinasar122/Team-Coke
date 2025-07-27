import React from "react";


const ActionButtons = ({ transactionType, onBack, onFinalize, onPay }) => {
  return (
    <div className="flex justify-end gap-4 mt-6 max-w-7xl mx-auto">
      <button onClick={onBack} className="bg-gray-500 text-white px-4 py-2 rounded">
        Back
      </button>

      {transactionType === "Van Load" && (
        <button onClick={onFinalize} className="bg-blue-600 text-white px-4 py-2 rounded">
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
