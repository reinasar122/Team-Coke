import React, { useEffect, useMemo, useRef, useState } from "react";

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

const ExpensesSection = ({ expenses = [], setExpenses, miscItems = [], setMiscItems }) => {
  const [activeTab, setActiveTab] = useState("Trading");
  const [newDesc, setNewDesc] = useState("");
  const [newAmt, setNewAmt] = useState("");
  const descRef = useRef(null);
  const amtRef = useRef(null);

  const isValidAmount = (val) => {
    if (val === "" || val === null || val === undefined) return false;
    const n = Number(val);
    return Number.isFinite(n) && n >= 0;
  };

  const total = useMemo(
    () =>
      miscItems.reduce((sum, item) => {
        const n = Number(item.amount);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [miscItems]
  );

  const handleAdd = () => {
    if (!newDesc.trim() || !isValidAmount(newAmt)) {
      if (!newDesc.trim()) descRef.current?.focus();
      else amtRef.current?.focus();
      return;
    }
    const clean = { description: newDesc.trim(), amount: Number(newAmt).toFixed(2) };
    setMiscItems([...(miscItems || []), clean]);
    setNewDesc("");
    setNewAmt("");
    descRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const updateItem = (index, field, value) => {
    const next = [...miscItems];
    if (field === "amount") {
      // keep raw typing but sanitize negatives
      if (value === "") next[index][field] = "";
      else next[index][field] = Math.max(0, Number(value)).toString();
    } else {
      next[index][field] = value;
    }
    setMiscItems(next);
  };

  const removeItem = (index) => {
    const next = miscItems.filter((_, i) => i !== index);
    setMiscItems(next);
  };

  const formatPreview = (val) => {
    const n = Number(val);
    return Number.isFinite(n) ? peso.format(n) : "₱0.00";
  };

  return (
    <div className="expenses-tab-container flex justify-end gap-2.5">
      <div className="w-full mb-4">
        {/* Tabs */}
        <div className="flex justify-end gap-2.5 border-b border-gray-200">
          {["Trading", "Expenses"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium text-sm rounded-t-md mb-0 transition
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

        {/* Expenses Tab */}
        {activeTab === "Expenses" && (
          <div className="w-full bg-white p-4 rounded-b-md shadow mt-0.5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base md:text-lg font-semibold text-gray-700">Expenses</h2>
              <div className="text-sm text-gray-500">
                Total:{" "}
                <span className="text-lg font-bold text-gray-800">{peso.format(total)}</span>
              </div>
            </div>

            <div className="rounded border border-gray-200 overflow-hidden">
              <div className="max-h-[48vh] overflow-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-700 sticky top-0 z-10">
                    <tr>
                      <th className="border-b border-gray-200 px-3 py-2 text-center w-14">No.</th>
                      <th className="border-b border-gray-200 px-3 py-2">Description</th>
                      <th className="border-b border-gray-200 px-3 py-2 text-right w-44">
                        Amount (₱)
                      </th>
                      <th className="border-b border-gray-200 px-3 py-2 text-center w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {miscItems.map((item, index) => (
                      <tr key={index} className="even:bg-white odd:bg-gray-50 hover:bg-gray-100/60">
                        <td className="px-3 py-2 text-center align-middle">{index + 1}</td>
                        <td className="px-3 py-2 align-middle">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(index, "description", e.target.value)}
                            className="w-full px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., Fuel, Parking, Snack"
                          />
                        </td>
                        <td className="px-3 py-2 text-right align-middle">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={item.amount}
                            onChange={(e) => updateItem(index, "amount", e.target.value)}
                            onBlur={(e) =>
                              updateItem(
                                index,
                                "amount",
                                isValidAmount(e.target.value)
                                  ? Number(e.target.value).toFixed(2)
                                  : "0.00"
                              )
                            }
                            className="w-full text-right px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-3 py-2 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50"
                            aria-label={`Remove expense row ${index + 1}`}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Draft Row */}
                    <tr className="bg-white">
                      <td className="px-3 py-2 text-center align-middle">+</td>
                      <td className="px-3 py-2 align-middle">
                        <input
                          ref={descRef}
                          type="text"
                          placeholder="New description"
                          value={newDesc}
                          onChange={(e) => setNewDesc(e.target.value)}
                          onKeyDown={handleKeyDown}
                          className="w-full px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-right align-middle">
                        <input
                          ref={amtRef}
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={newAmt}
                          onChange={(e) => setNewAmt(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={(e) => {
                            if (e.target.value !== "" && !isValidAmount(e.target.value)) {
                              setNewAmt("0.00");
                            }
                          }}
                          className="w-full text-right px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {newAmt !== "" && (
                          <div className="mt-1 text-xs text-gray-500">
                            Preview: <span className="font-medium">{formatPreview(newAmt)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center align-middle">
                        <button
                          type="button"
                          onClick={handleAdd}
                          disabled={!newDesc.trim() || !isValidAmount(newAmt)}
                          className={`px-3 py-1 rounded font-medium transition
                            ${
                              !newDesc.trim() || !isValidAmount(newAmt)
                                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                            }`}
                          aria-label="Add expense"
                          title="Add expense"
                        >
                          Add
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Footer total (sticky-look) */}
              <div className="flex items-center justify-end gap-3 px-3 py-2 bg-gray-50 border-t border-gray-200">
                <span className="text-sm text-gray-600">Total</span>
                <span className="text-lg font-semibold">{peso.format(total)}</span>
              </div>
            </div>

            {/* Small helper text */}
            <p className="mt-2 text-xs text-gray-500">
              Tip: Press <span className="font-semibold">Enter</span> to add the expense when both
              fields are filled.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpensesSection;
