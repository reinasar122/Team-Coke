import React, { useState } from "react";

const Expences = () => {
  const [miscCharges, setMiscCharges] = useState("");
  const [showMiscDetails, setShowMiscDetails] = useState(false);
  const [miscDescription, setMiscDescription] = useState("");
  const [miscItems, setMiscItems] = useState([]);
  const [miscAmounts, setMiscAmounts] = useState({});
  const [miscFiles, setMiscFiles] = useState([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState([]);
  const [zoomed, setZoomed] = useState(null);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Expenses</h2>
      
      <div className="flex items-start gap-4">
        <label className="w-40 text-right pt-2 font-medium text-gray-700">Expenses:</label>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <input
              className="w-full p-2 border rounded shadow-sm bg-gray-100 text-right font-semibold text-gray-700"
              value={miscCharges}
              onChange={(e) => setMiscCharges(e.target.value)}
              disabled
            />
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-600">
              <input
                type="checkbox"
                checked={showMiscDetails}
                onChange={(e) => setShowMiscDetails(e.target.checked)}
                className="scale-125 accent-blue-600"
              />
              <span>Details</span>
            </label>
          </div>

          {showMiscDetails && (
            <div className="bg-white border rounded-lg shadow p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Descriptions (comma separated)</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded shadow-sm"
                  value={miscDescription}
                  onChange={(e) => {
                    const value = e.target.value;
                    setMiscDescription(value);
                    const parts = value
                      .split(",")
                      .map((item) => item.trim())
                      .filter((item) => item !== "");
                    setMiscItems(parts);
                    const updated = { ...miscAmounts };
                    parts.forEach((item) => {
                      if (!(item in updated)) updated[item] = "";
                    });
                    setMiscAmounts(updated);
                  }}
                  placeholder="E.g. toll fee, repair, snacks"
                />
              </div>

              {miscItems.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Amount per Item</label>
                  <div className="space-y-2">
                    {miscItems.map((item, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <span className="w-32 text-right text-sm text-gray-600">{item}:</span>
                        <input
                          type="number"
                          className="flex-1 p-2 border rounded shadow-sm text-right"
                          placeholder="₱"
                          value={miscAmounts[item] || ""}
                          onChange={(e) => {
                            const updated = { ...miscAmounts };
                            updated[item] = e.target.value;
                            setMiscAmounts(updated);
                            const total = Object.values(updated)
                              .map((val) => parseFloat(val) || 0)
                              .reduce((sum, val) => sum + val, 0);
                            setMiscCharges(total.toFixed(2));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Attach Files (Photos/Receipts)</label>
                <input
                  type="file"
                  className="w-full p-2 border rounded"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files);
                    const previews = files.map((file) => ({
                      file,
                      url: URL.createObjectURL(file),
                    }));
                    setMiscFiles((prev) => [...prev, ...files]);
                    setImagePreviewUrls((prev) => [...prev, ...previews]);
                  }}
                />
                {imagePreviewUrls.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {imagePreviewUrls.map((preview, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={preview.url}
                          alt={`Preview ${index}`}
                          className="h-24 w-24 object-cover border rounded shadow cursor-zoom-in"
                          onClick={() => setZoomed(preview.url)}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updatedPreviews = [...imagePreviewUrls];
                            const updatedFiles = [...miscFiles];
                            updatedPreviews.splice(index, 1);
                            updatedFiles.splice(index, 1);
                            setImagePreviewUrls(updatedPreviews);
                            setMiscFiles(updatedFiles);
                          }}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-700"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {zoomed && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
          onClick={() => setZoomed(null)}
        >
          <img
            src={zoomed}
            alt="Zoomed"
            className="max-w-[90%] max-h-[90%] rounded shadow-lg"
          />
        </div>
      )}
    </div>
  );
};

export default Expences;
