import { useState } from "react";
import { inventoryItems } from "./Stocks";
import { FaEdit, FaTrash, FaSave, FaTimes, FaCheck } from "react-icons/fa";

export default function StocksAdjustment() {
    const [items, setItems] = useState([...inventoryItems].sort((a, b) => a.quantity - b.quantity));
    const [searchTerm, setSearchTerm] = useState("");
    const [log, setLog] = useState([]);
    const [remarks, setRemarks] = useState("");
    const [editItems, setEditItems] = useState({});

    const handleDelete = (id) => {
        setItems(prevItems => prevItems.filter(item => item.id !== id));
        setLog(prevLog => [...prevLog, { action: "Deleted", id, timestamp: new Date().toLocaleString(), remarks }]);
        setRemarks("");
    };

    const handleEdit = (id, item) => {
        setEditItems(prev => ({
            ...prev,
            [id]: {
                ...item,
                prices: item.prices ? { ...item.prices } : { supplier: "", retail: "" }
            }
        }));
    };
    
    const handleInputChange = (id, field, value) => {
        // Ensure numeric fields only accept valid numbers
        const sanitizedValue = field.startsWith("prices.") ? value.replace(/[^0-9.]/g, "") : value;
        
        setEditItems(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                [field]: field.startsWith("prices.")
                    ? { ...prev[id].prices, [field.split(".")[1]]: sanitizedValue }
                    : sanitizedValue,
            },
        }));
    };
    
    const handleSaveEdit = (id) => {
        const oldItem = items.find(item => item.id === id);
        const newItem = editItems[id];
        const changes = Object.entries(newItem).reduce((acc, [key, value]) => {
            if (JSON.stringify(oldItem[key]) !== JSON.stringify(value)) {
                acc.push(`${key}: ${oldItem[key]} → ${value}`);
            }
            return acc;
        }, []);
    
        setItems(prevItems => prevItems.map(item => (item.id === id ? newItem : item)));
        setLog(prevLog => [...prevLog, { action: "Edited", id, timestamp: new Date().toLocaleString(), changes }]);
        setRemarks("");
    
        setEditItems(prev => {
            const newEditItems = { ...prev };
            delete newEditItems[id];
            return newEditItems;
        });
    };
    
    const handleCancel = () => {
        setEditItems({});
    };

    const handleSave = () => {
        console.log("Saving data...");
        setLog(prevLog => [...prevLog, { action: "Saved", timestamp: new Date().toLocaleString(), remarks }]);
        setRemarks("");
    };

    const filteredItems = items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Stock Adjustment</h1>
            <div className="flex gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Search product..."
                    className="p-2 border flex-1"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Enter remarks..."
                    className="p-2 border flex-1"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                />
            </div>
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
                        <th className="p-2">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredItems.map(item => (
                        <tr key={item.id} className="border-t">
                            {editItems[item.id] ? (
                                <>
                                    <td className="p-2"><input type="text" value={editItems[item.id].SystemCode} onChange={(e) => handleInputChange(item.id, 'SystemCode', e.target.value)} className="border p-1" /></td>
                                    <td className="p-2">{editItems[item.id].name}</td>
                                    <td className="p-2">{editItems[item.id].type}</td>
                                    <td className="p-2"><input type="text" value={editItems[item.id].quantity} onChange={(e) => handleInputChange(item.id, 'quantity', e.target.value)} className="border p-1" /></td>
                                    <td className="p-2"><input type="text" value={editItems[item.id].prices.supplier || ''} onChange={(e) => handleInputChange(item.id, 'prices.supplier', e.target.value)} className="border p-1" /></td>
                                    <td className="p-2"><input type="text" value={editItems[item.id].prices.retail || ''} onChange={(e) => handleInputChange(item.id, 'prices.retail', e.target.value)} className="border p-1" /></td>
                                    <td className="p-2">{editItems[item.id].supplier}</td>
                                    <td className="p-2 flex">
                                        <button onClick={() => handleSaveEdit(item.id)} className="text-green-500 mx-2">
                                            <FaCheck size={24} />
                                        </button>
                                        <button className="text-red-500 mx-2" onClick={handleCancel}>
                                            <FaTimes size={24} />
                                        </button>
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td className="p-2">{item.SystemCode}</td>
                                    <td className="p-2">{item.name}</td>
                                    <td className="p-2">{item.type}</td>
                                    <td className="p-2">{item.quantity}</td>
                                    <td className="p-2">{item.prices.supplier}</td>
                                    <td className="p-2">{item.prices.retail}</td>
                                    <td className="p-2">{item.supplier}</td>
                                    <td className="p-2">
                                        <button onClick={() => handleEdit(item.id, item)} className="text-blue-500 mx-2">
                                            <FaEdit />
                                        </button>
                                        <button onClick={() => handleDelete(item.id)} className="text-red-500">
                                            <FaTrash />
                                        </button>
                                    </td>
                                </>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
            <button onClick={handleSave} className="mt-4 p-2 bg-blue-500 text-white rounded float-right">
                <FaSave className="inline mr-2" /> Save
            </button>
            <h2 className="text-xl font-bold mt-4">Activity Log</h2>
            <ul className="border p-2">
                {log.map((entry, index) => (
                    <li key={index} className="border-b p-2">
                        {entry.timestamp} - {entry.action} {entry.id ? `Item ID: ${entry.id}` : ""} {entry.remarks ? ` - Remarks: ${entry.remarks}` : ""}
                    </li>
                ))}
            </ul>
        </div>
    );
}