import React, { useState } from "react";

export default function LoadOutPage() {
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [unitType, setUnitType] = useState("piece");
  const [returned, setReturned] = useState(0);
  const [salesType, setSalesType] = useState("warehouse");
  const [loadOutList, setLoadOutList] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const products = [
    { id: 1, name: "Coke 1.5L", stock: 120, returnable: true },
    { id: 2, name: "Coke Sakto", stock: 200, returnable: false },
    { id: 3, name: "Coke Zero", stock: 90, returnable: true },
  ];

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToLoadOut = () => {
    if (!selectedProduct || quantity <= 0) return;

    const productDetails = products.find((p) => p.id.toString() === selectedProduct);
    if (quantity > productDetails.stock) {
      alert("Not enough stock!");
      return;
    }

    const newItem = {
      id: selectedProduct,
      name: productDetails.name,
      quantity: Number(quantity),
      unit: unitType,
      returned: productDetails.returnable && salesType === "delivery" ? returned : 0,
      salesType,
    };

    setLoadOutList([...loadOutList, newItem]);
    setQuantity(0);
    setReturned(0);
    setSelectedProduct("");
    setSalesType("warehouse");
    setSearchTerm("");
  };

  const removeItem = (index) => {
    const updatedList = [...loadOutList];
    updatedList.splice(index, 1);
    setLoadOutList(updatedList);
  };

  const confirmLoadOut = () => {
    alert("Load out confirmed!");
    setLoadOutList([]);
    setShowConfirm(false);
  };

  const totalAmount = loadOutList.reduce((acc, item) => acc + Number(item.total), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div>
        <h1>Transaction no. </h1>
      </div>
      <div>
        <h1></h1>
      </div>
      <h1 className="text-2xl font-bold mb-4">Product Load Out</h1>

      <div className="bg-white shadow-md rounded p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <h1>Product Name</h1>
          <input
            type="text"
            id="productSearch"
            name="productSearch"
            placeholder="Search product..."
            className="border p-2 rounded w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <ul className="absolute z-10 w-full border mt-1 rounded max-h-40 overflow-y-auto bg-white shadow-lg">
              {filteredProducts.map((product) => (
                <li
                  key={product.id}
                  className={`p-2 hover:bg-blue-100 cursor-pointer ${selectedProduct === product.id.toString() ? "bg-blue-200" : ""}`}
                  onClick={() => {
                    setSelectedProduct(product.id.toString());
                    setSearchTerm(product.name);
                  }}
                >
                  {product.name} (Stock: {product.stock})
                </li>
              ))}
            </ul>
          )}
        </div>
         <div>
          <h1>Unit Type</h1>
            <select
              value={unitType}
              onChange={(e) => setUnitType(e.target.value)}
              className="border p-2 rounded"
            >
              <option value="box">Box</option>
              <option value="pack">Pack</option>
              <option value="case">Case</option>
              <option value="piece">Piece</option>
            </select>
        </div>
        <div>
         <h1>Quantity</h1>
         <input
          type="number"
          id="quantity"
          name="quantity"
          className="border p-2 rounded"
         value={quantity === 0 ? "" : quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
        </div>
       

        {selectedProduct && products.find(p => p.id.toString() === selectedProduct)?.returnable && salesType === "delivery" && (
         <input
            type="number"
            id="returned"
            name="returned"
            placeholder="Returned"
            value={returned}
            onChange={(e) => setReturned(Number(e.target.value))}
          />
        )}

        <div className="md:col-span-4">
          <label className="mr-4">
            <input
              type="radio"
              value="warehouse"
              checked={salesType === "warehouse"}
              onChange={(e) => setSalesType(e.target.value)}
              className="mr-1"
            />
            Warehouse Sale
          </label>
          <label>
            <input
              type="radio"
              value="delivery"
              checked={salesType === "delivery"}
              onChange={(e) => setSalesType(e.target.value)}
              className="mr-1"
            />
            Delivery Sale
          </label>
        </div>

        <div className="md:col-span-4 text-right">
          <button
            onClick={addToLoadOut}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded p-4 mb-6">
        <h2 className="text-xl font-semibold mb-4">Load Out Summary</h2>
        {loadOutList.length === 0 ? (
          <p className="text-gray-500">No items added.</p>
        ) : (
          <table className="w-full text-left border-t">
            <thead>
              <tr>
                <th className="py-2">Product</th>
                <th className="py-2">Unit Type</th>
                <th className="py-2">Conversion Factor</th>
                <th className="py-2">Quantity</th>
                <th className="py-2">Total Pieces</th>
                <th className="py-2">Selling Price</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Selling Type</th>
                <th className="py-2">Action</th>

              </tr>
            </thead>
            <tbody>
              {loadOutList.map((item, index) => (
                <tr key={index} className="border-t">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2">{item.unitType}</td>
                  <td className="py-2">{item.coversionFactor}</td>
                  <td className="py-2">{item.quantity}</td>
                  <td className="py-2">{item.totalPieces}</td>
                  <td className="py-2">{item.sellingPrice}</td>
                  <td className="py-2">{item.amount}</td>
                  <td className="py-2 capitalize">{item.salesType}</td>
                  <td className="py-2">
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-between items-center">
        <p className="text-lg font-medium">Expected Total Amount: {totalAmount}</p>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={loadOutList.length === 0}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          Confirm Load Out
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Confirm Load Out</h3>
            <ul className="mb-4 list-disc pl-5">
              {loadOutList.map((item, i) => (
                <li key={i}>{item.quantity} x {item.name} [{item.salesType}] {item.returned > 0 ? `- Returned: ${item.returned}` : ""}</li>
              ))}
            </ul>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={confirmLoadOut}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
