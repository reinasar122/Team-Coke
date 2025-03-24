import React, { useEffect, useState } from "react";
import axios from "axios";

const App = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    axios.get("http://127.0.0.1:8000/api/items/")
      .then(response => {
        console.log("API Response:", response.data);
        setItems(response.data);
      })
      .catch(error => console.error("Error fetching data:", error));
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-blue-600 mb-4">Items from Django API</h1>
      
      {items.length > 0 ? (
        <ul className="w-full max-w-md bg-white shadow-md rounded-lg p-4">
          {items.map((item) => (
            <li key={item.id} className="p-2 border-b border-gray-300 last:border-none">
              <span className="font-semibold text-gray-700">{item.name}</span>: 
              <span className="text-gray-600"> {item.description}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-red-500 font-semibold">No data found.</p>
      )}

      <button 
        className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow-lg transition-all"
        onClick={() => window.location.reload()}
      >
        Refresh Data
      </button>
    </div>
  );
};

export default App;
