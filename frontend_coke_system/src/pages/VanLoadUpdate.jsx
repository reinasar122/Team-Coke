import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';

const VanLoadUpdate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const saleId = location.state?.id;
  const [sale, setSale] = useState(null);
  const [products, setProducts] = useState([]);
  const [rows, setRows] = useState([]);
  const [pricingMap, setPricingMap] = useState({});
  


  const totalExpectedSale = rows.reduce((sum, row) => sum + (parseFloat(row.expectedSale) || 0), 0);
  const totalActualSale = rows.reduce((sum, row) => sum + (parseFloat(row.actual_sale) || 0), 0);


  useEffect(() => {
  if (!saleId) return;

  axios.get(`http://localhost:8080/api/merchandising-set/${saleId}/`)
    .then((res) => {
      setSale(res.data);

      if (res.data.items && Array.isArray(res.data.items)) {
        setRows(res.data.items.map(item => ({
          ...item,
          productId: item.product?.id,
          product_name: item.product?.product_name || "",
          selling_price: parseFloat(item.product?.selling_price) || 0,
          empty_price_shell: parseFloat(item.product?.empty_price_shell) || 0,
          empty_price_pc: parseFloat(item.product?.empty_price_pc) || 0,
          actual_sale: 0,
          discount: item.discount || 0,
          sold_shell: item.sold_shell || 0,
          sold_pcs: item.sold_pcs || 0,
          empty_return_shell: item.empty_return_shell || 0,
          empty_return_pcs: item.empty_return_pcs || 0,
          discrepancy_empties_shell: item.discrepancy_empties_shell || 0,
          discrepancy_empties_pc: item.discrepancy_empties_pc || 0,
          actual_return_shell: item.actual_return_shell || 0,
          actual_return_pcs: item.actual_return_pcs || 0,
          discrepancy_full_shell: item.discrepancy_full_shell || 0,
          discrepancy_full_pcs: item.discrepancy_full_pcs || 0,
          discount: item.discount_percent || item.discount || 0,
        })));
      }
    })
    .catch((err) => {
      console.error(err);
      alert("Failed to fetch sale data.");
    });
}, [saleId, navigate]);


  // Fetch product data and create pricing map
  useEffect(() => {
    axios.get('http://localhost:8080/api/products/')
      .then((res) => {
        setProducts(res.data);
        const priceMap = {};
        res.data.forEach(prod => {
          priceMap[prod.id] = prod;
        });
        setPricingMap(priceMap);

      })
      .catch((err) => {
        console.error('Failed to fetch products:', err);

      });
  }, []);

  const handleRowChange = (index, field, value) => {
    const updatedRows = [...rows];
    updatedRows[index][field] = value;

    if (['soldPcs', 'soldShell', 'discount'].includes(field)) {
      const productId = updatedRows[index].productId;
      const price = parseFloat(updatedRows[index].product?.selling_price) || 0;
      const pcs = parseFloat(updatedRows[index].soldPcs) || 0;
      const shells = parseFloat(updatedRows[index].soldShell) || 0;
      const discount = parseFloat(updatedRows[index].discount) || 0;

      const raw = (pcs + shells) * price;
      updatedRows[index].actual_sale = raw * ((100 - discount) / 100);
    }

    setRows(updatedRows);
  };

  if (!sale) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading sale data...
      </div>
    );
  }

  const handleSubmit = () => {
  if (!sale || sale.transaction_type_name !== "Van Load") {
    alert("This update is only applicable to Van Load transactions.");
    return;
  }

  const payload = {
    sale_id: saleId,
    total_expected_sale: totalExpectedSale,
    total_actual_sale: totalActualSale,
    products: rows.map(row => ({
      productId: row.productId,
      sold_shell: row.sold_shell,
      sold_pcs: row.sold_pcs,
      discount: row.discount,
      actual_sale: row.actual_sale,
      empty_return_shell: row.empty_return_shell,
      empty_return_pcs: row.empty_return_pcs,
      discrepancy_empties_shell: row.discrepancy_empties_shell,
      discrepancy_empties_pc: row.discrepancy_empties_pc,
      actual_return_shell: row.actual_return_shell,
      actual_return_pcs: row.actual_return_pcs,
      discrepancy_full_shell: row.discrepancy_full_shell,
      discrepancy_full_pcs: row.discrepancy_full_pcs
    })
  )};

  axios.post("http://localhost:8080/api/van-load-return/", payload)
    .then(() => {
      alert("Van Load return successfully submitted.");
      navigate("/merchandising-sale");
    })
    .catch((error) => {
      console.error("Submission failed:", error);
      alert("Failed to submit van load return.");
    });
};

  return (
    <div className="w-100 mx-auto p-6 bg-white shadow rounded-lg mt-4">
      <h2 className="text-2xl font-bold mb-6 text-blue-600">Van Load Return</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <label className="font-semibold">MSP No:</label>
          <div className="p-2 border rounded">{sale.msp_no}</div>
        </div>
        <div>
          <label className="font-semibold">Transaction Type:</label>
          <div className="p-2 border rounded">{sale.transaction_type_name}</div>
        </div>
        <div>
          <label className="font-semibold">Handled By:</label>
          <div className="p-2 border rounded">{sale.handled_by}</div>
        </div>
        <div>
          <label className="font-semibold">Date Created:</label>
          <div className="p-2 border rounded">{new Date(sale.date_time).toLocaleString()}</div>
        </div>
      </div>

      <h3 className="text-lg font-semibold mt-6 mb-2">Product Details</h3>
      <table className="w-full text-sm text-center border border-gray-300 rounded shadow-sm mb-5">
        <thead className="bg-gray-100 text-gray-800">
          <tr className="text-xs font-semibold">
            <th className="border border-gray-300 py-2 px-1">PRODUCT</th>
            <th className="border border-gray-300 py-2 px-1" colSpan={2}>DISPATCHED</th>
            <th className="border border-gray-300 py-2 px-1">SELLING PRICE</th>
            <th className="border border-gray-300 py-2 px-1" colSpan={2}>SOLD</th>
            <th className="border border-gray-300 py-2 px-1" colSpan={2}>EMPTY PRICE</th>
            <th className="border border-gray-300 py-2 px-1" colSpan={2}>RETURNED (Empty)</th>
            <th className="border border-gray-300 py-2 px-1" colSpan={2}>DISCREPANCY (Empty)</th>
            <th className="border border-gray-300 py-2 px-1" colSpan={2}>RETURNED (With Content/s)</th>
            <th className="border border-gray-300 py-2 px-1" colSpan={2}>DISCREPANCY (Non-empty)</th>
            <th className="border border-gray-300 py-2 px-1">DISCOUNT (%)</th>
            <th className="border border-gray-300 py-2 px-1">EXPECTED SALE</th>
            <th className="border border-gray-300 py-2 px-1">ACTUAL SALE</th>
          </tr>
          <tr className="bg-gray-200">
            <td className="border border-gray-300 py-1"></td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
            <td className="border border-gray-300 py-1"></td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
            <td className="border border-gray-300 py-1"></td>
            <td className="border border-gray-300 py-1"></td>
            <td className="border border-gray-300 py-1"></td>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className="bg-white hover:bg-gray-50 transition duration-150">
             <td className="border border-gray-200 py-1 px-1 w-[120px]">
                <div className="p-2 border rounded">
                  {row.product_name || `Product #${row.productId}`}
                </div>
              </td>
              <td className="border border-gray-200 py-1 px-1">
                <div className="p-2 border rounded">{row.dispatched_shell}</div>
              </td>
              <td className="border border-gray-200 py-1 px-1">
                <div className="p-2 border rounded">{row.dispatched_pcs}</div>
              </td>
              <td className="border border-gray-200 py-1 px-1">
                <div className="p-2 border rounded">{row.product?.selling_price || 0}</div>
              </td>

              <td className="border border-gray-200 py-1 px-1">
                <input type="number" className="w-full p-1 text-sm text-center rounded bg-yellow-50" value={row.sold_shell || ""} onChange={(e) => handleRowChange(index, "sold_shell", e.target.value)} />
              </td>
              <td className="border border-gray-200 py-1 px-1">
                <input type="number" className="w-full p-1 text-sm text-center rounded bg-yellow-50" value={row.sold_pcs || ""} onChange={(e) => handleRowChange(index, "sold_pcs", e.target.value)} />
              </td>

              <td className="border border-gray-200 py-1 px-1">
                <input
                  type="number"
                  className="w-full p-1 text-sm text-center bg-gray-100"
                  value={row.empty_price_shell || ""}
                  disabled
                />
              </td>
              <td className="border border-gray-200 py-1 px-1">
                <input
                  type="number"
                  className="w-full p-1 text-sm text-center bg-gray-100"
                  value={row.empty_price_pc || ""}
                  disabled
                />
              </td>


              {[
                "empty_return_shell", "empty_return_pcs",
                "discrepancy_empties_shell", "discrepancy_empties_pc",
                "actual_return_shell", "actual_return_pcs",
                "discrepancy_full_shell", "discrepancy_full_pcs"
              ].map((field, i) => (
                <td key={i} className="border border-gray-200 py-1 px-1">
                  <input
                    type="number"
                    value={row[field] === 0 ? "" : row[field]}
                    onChange={(e) => handleRowChange(index, field, e.target.value)}
                    disabled={field.includes("discrepancy")}
                    className={`w-full p-1 text-sm text-center rounded
                      ${field.includes("expectedReturn") ? "bg-yellow-50" : "bg-gray-100"}
                      ${field.includes("discrepancy") && parseInt(row[field]) !== 0 ? "bg-red-100 text-red-700 font-semibold" : ""}`}
                  />
                </td>
              ))}

              <td className="border border-gray-200 py-1 px-1">
                <input
                  type="number"
                  className={`w-full p-1 text-sm text-center rounded bg-white border ${row.sold_shell > 0 || row.sold_pcs > 0 ? "bg-yellow-50" : "bg-gray-200 cursor-not-allowed"}`}
                  value={row.discount === 0 ? "" : row.discount}
                  onChange={(e) => handleRowChange(index, "discount", e.target.value)}
                  disabled={!(row.sold_shell > 0 || row.sold_pcs > 0)}
                />
              </td>

              <td className="border border-gray-200 py-1 px-1">
                <div className="p-2 border rounded">{row.expected_sale}</div>
              </td>
              <td className="border border-gray-200 py-1 px-1">
                <input
                  className="w-full p-1 text-center bg-gray-50 text-gray-800 font-medium"
                  disabled
                  value={row.actual_sale ? `₱${parseFloat(row.actual_sale).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : ""}
                />
              </td>
            </tr>
          ))}

          <tr className="bg-gray-200 font-semibold text-[13px] text-right">
            <td className="border border-gray-300 py-2 px-1 text-center">TOTAL</td>
            <td className="border border-gray-300 py-2 px-1 text-center"></td>
            <td className="border border-gray-300 py-2 px-1 text-center"></td>
            <td className="border border-gray-300 py-2 px-1 text-center"></td>
            <td className="border border-gray-300 py-2 px-1 text-center"></td>
            <td className="border border-gray-300 py-2 px-1 text-center"></td>
            {Array(10).fill(null).map((_, i) => (
              <td key={i} className="border border-gray-300 py-2 px-1"></td>
            ))}
            <td className="border border-gray-300 py-2 px-1"></td>
            <td className="border border-gray-300 py-2 px-1 text-green-700">₱{totalExpectedSale.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
            <td className="border border-gray-300 py-2 px-1 text-blue-700">₱{totalActualSale.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>
      <div className="md:col-span-2">
        <label className="font-semibold">Remarks:</label>
        <div className="p-2 border rounded">{sale.remarks || "None"}</div>
      </div>
      
        <div className="flex justify-end gap-4 mt-6 max-w-7xl mx-auto">
            <button
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
                onClick={handleSubmit}
                >
                Submit Van Load Return
            </button>
        </div>
    </div>
  );
};

export default VanLoadUpdate;
