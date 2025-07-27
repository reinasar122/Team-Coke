import React, { useState, useEffect, useMemo } from "react";

const ExpensesSection = ({ expenses = [], setExpenses }) => {
  const [activeTab, setActiveTab] = useState("Trading");
  const [newDesc, setNewDesc] = useState("");
  const [newAmt, setNewAmt] = useState("");
  const [miscItems, setMiscItems] = useState([]);
  const [miscAmounts, setMiscAmounts] = useState({});

  const calculateTotalExpenses = () => {
  const miscTotal = miscItems.reduce((sum, item) => {
    const amt = parseFloat(item.amount);
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  const extra = parseFloat(newAmt);
  return miscTotal + (isNaN(extra) ? 0 : extra);
};

  const handleExpenseChange = (index, field, value) => {
    const updated = [...expenses];
    updated[index][field] = value;
    setExpenses(updated);
  };

  const handleFileChange = (index, file) => {
    const updated = [...expenses];
    updated[index].attachment = file;
    setExpenses(updated);
  };

  const addExpense = () => {
    setExpenses([...expenses, { description: "", amount: "", attachment: null }]);
  };

  const removeExpense = (index) => {
    const updated = [...expenses];
    updated.splice(index, 1);
    setExpenses(updated);
  };

  return (
    <div className="expenses-tab-container flex justify-end gap-2.5">
       {/* TABS: Trading | Expenses */}
        <div className="w-full mb-4">
        <div className="flex justify-end gap-2.5 border-b border-gray-300">
        {["Trading", "Expenses"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-semibold text-sm rounded-t-md mb-4
              ${
                activeTab === tab
                  ? "bg-white text-blue-600 border border-b-white border-gray-300"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent"
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Expenses Table */}
      {activeTab === "Expenses" && (
        <div className="w-full bg-white p-4 rounded-b-md shadow mt-1">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Expenses</h2>

          <table className="w-full text-sm text-left border border-gray-300 rounded shadow">
            <thead className="bg-gray-100 text-gray-800">
              <tr>
                <th className="border border-gray-300 px-3 py-2 text-center">No.</th>
                <th className="border border-gray-300 px-3 py-2">Description</th>
                <th className="border border-gray-300 px-3 py-2 text-right">Amount (₱)</th>
              </tr>
            </thead>
            <tbody>
              {miscItems.map((item, index) => (
                <tr key={index} className="bg-white hover:bg-gray-50">
                  <td className="border border-gray-300 px-3 py-2 text-center">{index + 1}</td>
                  <td className="border border-gray-300 px-3 py-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => {
                        const newItems = [...miscItems];
                        newItems[index].description = e.target.value;
                        setMiscItems(newItems);
                      }}
                      className="w-full px-2 py-1 rounded border border-gray-300"
                    />
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right">
                    <input
                      type="number"
                      value={item.amount}
                      onChange={(e) => {
                        const newItems = [...miscItems];
                        newItems[index].amount = e.target.value;
                        setMiscItems(newItems);
                      }}
                      className="w-full text-right px-2 py-1 rounded border border-gray-300"
                    />
                  </td>
                </tr>
              ))}
              {/* Add New Row */}
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-3 py-2 text-center">+</td>
                <td className="border border-gray-300 px-3 py-2">
                  <input
                    type="text"
                    placeholder="New description"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-2 py-1 rounded border border-gray-300"
                  />
                </td>
                <td className="border border-gray-300 px-3 py-2 text-right">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={newAmt}
                    onChange={(e) => setNewAmt(e.target.value)}
                    className="w-full text-right px-2 py-1 rounded border border-gray-300"
                  />
                </td>
              </tr>
            </tbody>
          </table>

          {/* 🧮 Total Expenses */}
          <div className="mt-2 text-right text-sm font-medium text-gray-700">
            Total: <span className="text-lg font-bold">₱{calculateTotalExpenses().toFixed(2)}</span>
          </div>

          <div className="flex justify-end mt-3">
            <button
              onClick={() => {
                if (newDesc && newAmt) {
                  setMiscItems([...miscItems, { description: newDesc, amount: newAmt }]);
                  setNewDesc("");
                  setNewAmt("");
                }
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              + Add Expense
            </button>
          </div>
        </div>
      )}
    </div>
  </div>

  );
};

export default ExpensesSection;
