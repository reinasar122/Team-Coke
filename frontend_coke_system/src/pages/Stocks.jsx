import { useState } from "react";


export const inventoryItems = [
    { id: 1, name: "Tanduay", type: "Alcoholic", SystemCode: "I05279", status: "Out of Stock", prices: { supplier: "$20", retail: "$25" }, quantity: 0 },
    { id: 2, name: "Minute Maid", type: "Juice", SystemCode: "I05678", status: "Low", prices: { supplier: "$10", retail: "$15" }, quantity: 5 },
    { id: 3, name: "Coke 8oz", type: "Softdrink", SystemCode: "I01234", status: "Moderate", prices: { supplier: "$8", retail: "$12" }, quantity: 20 },
    { id: 4, name: "Water", type: "Hydration", SystemCode: "I01235", status: "High", prices: { supplier: "$2", retail: "$4" }, quantity: 50 },
    { id: 5, name: "Sprite 12oz", type: "Softdrink", SystemCode: "I01236", status: "High", prices: { supplier: "$9", retail: "$13" }, quantity: 30 },
    { id: 6, name: "Red Horse Beer", type: "Alcoholic", SystemCode: "I05280", status: "Low", prices: { supplier: "$18", retail: "$22" }, quantity: 10 },
    { id: 7, name: "Gatorade", type: "Hydration", SystemCode: "I05679", status: "Moderate", prices: { supplier: "$12", retail: "$16" }, quantity: 25 },
    { id: 8, name: "Pepsi 1L", type: "Softdrink", SystemCode: "I01237", status: "High", prices: { supplier: "$7", retail: "$11" }, quantity: 40 },
    { id: 9, name: "C2 Green Tea", type: "Tea", SystemCode: "I05700", status: "Low", prices: { supplier: "$6", retail: "$9" }, quantity: 7 },
    { id: 10, name: "Royal 500ml", type: "Softdrink", SystemCode: "I01238", status: "Moderate", prices: { supplier: "$5", retail: "$8" }, quantity: 15 },
    { id: 11, name: "Milo Drink", type: "Energy", SystemCode: "I05800", status: "High", prices: { supplier: "$9", retail: "$13" }, quantity: 35 },
    { id: 12, name: "Nestea Lemon", type: "Tea", SystemCode: "I05701", status: "Low", prices: { supplier: "$7", retail: "$10" }, quantity: 5 },
    { id: 13, name: "Ginebra San Miguel", type: "Alcoholic", SystemCode: "I05281", status: "Moderate", prices: { supplier: "$15", retail: "$20" }, quantity: 18 },
    { id: 14, name: "Del Monte Pineapple Juice", type: "Juice", SystemCode: "I05680", status: "High", prices: { supplier: "$8", retail: "$12" }, quantity: 50 },
    { id: 15, name: "Absolute Distilled Water", type: "Hydration", SystemCode: "I01239", status: "High", prices: { supplier: "$3", retail: "$5" }, quantity: 60 },
  ];
  
const statusColors = {
  "Out of Stock": "bg-gray-500",
  Low: "bg-red-500",
  Moderate: "bg-yellow-500",
  High: "bg-green-500",
};

export default function InventoryUI() {
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("cards");
  const [currentPage, setCurrentPage] = useState(1);
  
  const itemsPerPage = 6;
  
  const filteredItems = inventoryItems
    .filter(item => item.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.quantity - b.quantity);

    const calculateProfitMargin = (purchasePrice, sellingPrice) => {
        return `$${(parseFloat(sellingPrice.replace('$', '')) - parseFloat(purchasePrice.replace('$', ''))).toFixed(2)}`;
      };
      
  // Pagination logic
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredItems.slice(startIndex, endIndex);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4"> Stocks Inventory</h1>
      <div className="flex justify-between mb-4">
        <input
          type="text"
          placeholder="Search items..."
          className="w-full p-2 border rounded"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="ml-4 p-2 border rounded bg-blue-500 text-white"
          onClick={() => setViewMode(viewMode === "cards" ? "table" : "cards")}
        >
          {viewMode === "cards" ? "Switch to Table View" : "Switch to Card View"}
        </button>
      </div>

      {viewMode === "cards" ? (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
            {currentItems.map(item => (
              <div key={item.id} className="p-4 border shadow-md rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold">{item.name} ({item.type})</h2>
                    <span className={`px-3 py-1 text-white text-sm rounded-full ${statusColors[item.status]}`}>{item.status}</span>
                  </div>
                  <p className="text-sm text-gray-600">Supplier Price: {item.prices.supplier} | Retail: {item.prices.retail}</p>
                </div>
                <button
                  className="mt-2 text-blue-600 border p-2 rounded w-full"
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                >
                  {expanded === item.id ? "Hide Details" : "View Pricing & Quantity"}
                </button>
                {expanded === item.id && (
                  <div className="mt-3 border-t pt-3">
                    <p><strong>Quantity:</strong> {item.quantity}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="flex justify-center items-center mt-4 space-x-2">
            <button
              className={`p-2 border rounded ${currentPage === 1 ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 text-white"}`}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="px-4">Page {currentPage} of {totalPages}</span>
            <button
              className={`p-2 border rounded ${currentPage === totalPages ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 text-white"}`}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      ) : (
    <table className="w-full border text-center">
        <thead>
          <tr className="bg-gray-200 text-gray-700">
            <th className="p-2">System Code</th>
            <th className="p-2">Product Name</th>
            <th className="p-2">Category</th>
            <th className="p-2">Stock Qty.</th>
            <th className="p-2">Purchase Price</th>
            <th className="p-2">Selling Price</th>
            <th className="p-2">Supplier</th>
            <th className="p-2">Profit Margin</th>
            <th className="p-2">Stock Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.map(item => (
            <tr key={item.id} className="border-t">
              <td className="p-2">{item.SystemCode}</td>
              <td className="p-2">{item.name}</td>
              <td className="p-2">{item.type}</td>
              <td className="p-2">{item.quantity}</td>
              <td className="p-2">{item.prices.supplier}</td>
              <td className="p-2">{item.prices.retail}</td>
              <td className="p-2">Supplier Name</td>
              <td className="p-2">{calculateProfitMargin(item.prices.supplier, item.prices.retail)}</td>
              <td className={`p-2 text-white rounded ${statusColors[item.status]}`}>{item.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </div>
  );
}
