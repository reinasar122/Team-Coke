// src/pages/ForecastingDashboard.jsx
import React, { useMemo, useState, useEffect } from "react";
import api from "../api"; // ✅ centralized API instance

import { ForecastOverviewCards } from "../components/forecasting/ForecastOverviewCards";
import { ProductSelector } from "../components/forecasting/ProductSelector";
import { ForecastChart } from "../components/forecasting/ForecastChart";
import { ForecastTable } from "../components/forecasting/ForecastTable";
import { BestSellerRanking } from "../components/forecasting/BestSellerRanking";
import { InventoryRecommendations } from "../components/forecasting/InventoryRecommendations";
import { SeasonalInsights } from "../components/forecasting/SeasonalInsights";
import { HolidayCalendar } from "../components/forecasting/HolidayCalendar";

// token helper
const getToken = () =>
  localStorage.getItem("accessToken") ||
  localStorage.getItem("token") ||
  localStorage.getItem("access");

// attach Authorization header when token exists
const authHeaders = () => {
  const token = getToken();
  return token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : {};
};

// helper: if DRF uses pagination
const extractList = (data) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
};

export default function ForecastingDashboard() {
  const [products, setProducts] = useState([]);
  const [selectedProductName, setSelectedProductName] = useState("");
  const [forecastData, setForecastData] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const [bestSellerData, setBestSellerData] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);

  const [stocks, setStocks] = useState([]);

  // 1) Fetch product list
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await api.get("/products/"); // ✅ api style

        console.log("👉 /products/ response:", res.data);

        const data = res.data;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.results)
          ? data.results
          : [];

        console.log("👉 parsed product list:", list);

        setProducts(list);

        if (list.length > 0) {
          const firstName =
            list[0].product_name || list[0].name || list[0].product;
          setSelectedProductName(firstName);
        }
      } catch (err) {
        console.error("❌ Failed to load products:", err);
        const msg =
          err.response?.data?.detail ||
          err.message ||
          "Failed to load products";
        setError(msg);
      }
    };

    fetchProducts();
  }, []);


  // -----------------------
  // 1b) Fetch stocks
  // -----------------------
  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const res = await api.get("/stocks/"); // Fetch stock data
        const data = res.data;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.results)
          ? data.results
          : [];

        setStocks(list);
      } catch (err) {
        console.error("❌ Failed to load stocks:", err);
      }
    };

    fetchStocks();
  }, []);




  // 2) Fetch HOLIDAYS
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const res = await api.get("/holidays/", authHeaders()); // ✅ api.get

        console.log("👉 /holidays/ response:", res.data);

        setHolidays(extractList(res.data));
      } catch (err) {
        console.error("❌ Failed to load holidays:", err);
      }
    };

    fetchHolidays();
  }, []);

  // 3) Fetch FORECASTS when product changes
useEffect(() => {
  if (!selectedProductName || products.length === 0) return;

  const fetchForecasts = async () => {
    setLoading(true);
    setError(null);

    try {
      const productObj = products.find(
        (p) =>
          (p.product_name || p.name || p.product) === selectedProductName
      );

      if (!productObj) {
        setForecastData([]);
        setLoading(false);
        return;
      }

      const config = {
        ...authHeaders(),
        params: { product_id: productObj.id },
      };

      const res = await api.get("/forecasts/", config); // ✅ api.get

      setForecastData(extractList(res.data));
    } catch (err) {
      console.error("❌ Failed to fetch forecasts:", err);
      const msg =
        err.response?.data?.detail ||
        err.message ||
        "Failed to fetch forecasts from API";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  fetchForecasts();
}, [selectedProductName, products]);

  // Per-product best-seller + inventory
useEffect(() => {
  if (!forecastData.length || !selectedProductName) {
    setBestSellerData([]);
    setInventoryData([]);
    return;
  }

  const total30DayForecast = forecastData
    .slice(0, 30)
    .reduce((sum, row) => sum + (row.forecast || 0), 0);

  setBestSellerData([
    {
      product: selectedProductName,
      projectedSales: total30DayForecast,
      speedCategory:
        total30DayForecast > 1000
          ? "fast"
          : total30DayForecast > 300
          ? "stable"
          : "slow",
    },
  ]);

  // Getting the real stock (from your modified logic)
  const currentStock = getCurrentStock(selectedProductName);  // <-- Check here
  const restockNeeded = Math.max(total30DayForecast - currentStock, 0);

  setInventoryData([
    {
      product: selectedProductName,
      forecast30Day: total30DayForecast,
      currentStock,
      restock: restockNeeded,
    },
  ]);
}, [forecastData, selectedProductName, stocks]);

  // GLOBAL BEST SELLER + INVENTORY FOR ALL PRODUCTS
  useEffect(() => {
    const fetchGlobalForecasts = async () => {
      try {
        const res = await api.get("/forecasts/", authHeaders()); // ✅ api.get

        const allForecasts = extractList(res.data);
        if (!allForecasts.length) return;

        const grouped = {};
        allForecasts.forEach((row) => {
          const pName = row.product_name || row.product;
          if (!grouped[pName]) grouped[pName] = [];
          grouped[pName].push(row);
        });

        const ranking = [];
        const inventory = [];

        Object.keys(grouped).forEach((name) => {
          const forecast30 = grouped[name]
            .slice(0, 30)
            .reduce((sum, r) => sum + (r.forecast || 0), 0);

          let speed = "slow";
          if (forecast30 > 1000) speed = "fast";
          else if (forecast30 > 300) speed = "stable";

          ranking.push({
            product: name,
            projectedSales: forecast30,
            speedCategory: speed,
          });

          const currentStock = 500;
          const restock = Math.max(forecast30 - currentStock, 0);

          inventory.push({
            product: name,
            forecast30Day: forecast30,
            currentStock,
            restock,
          });
        });

        ranking.sort((a, b) => b.projectedSales - a.projectedSales);

        setBestSellerData(ranking);
        setInventoryData(inventory);
      } catch (err) {
        console.log("❌ Global ranking failed:", err);
      }
    };

    fetchGlobalForecasts();
  }, [products, forecastData]);

  // 4) Generate FORECAST (Prophet in backend)
  const handleGenerateForecast = async (days = 30) => {
    setGenerating(true);
    setError(null);

    try {
      const productObj = products.find(
        (p) =>
          (p.product_name || p.name || p.product) === selectedProductName
      );

      if (!productObj) {
        setError("Please select a valid product");
        setGenerating(false);
        return;
      }

      const res = await api.post(
        "/forecasts/generate/",
        {
          product: productObj.id,
          days,
        },
        authHeaders() // ✅ api.post
      );

      console.log("👉 /forecasts/generate/ response:", res.data);

      setForecastData(extractList(res.data));
    } catch (err) {
      console.error("❌ Generate forecast failed:", err);
      const msg =
        err.response?.data?.detail ||
        err.message ||
        "Generate forecast failed";
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };


  // Function to get the current stock for a selected product
const getCurrentStock = (productName) => {
  if (!productName || !stocks.length) return 0;

  const normalized = productName.trim().toLowerCase();

  // Find the stock for this product
  const candidates = stocks.filter(
    (s) =>
      s.product_name &&
      s.product_name.trim().toLowerCase() === normalized
  );

  if (!candidates.length) {
    console.log("❌ No stock rows for", productName, "stocks:", stocks);
    return 0;
  }

  // Log candidates to debug
  console.log("👉 Stock candidates:", candidates);

  // Prefer matching warehouse; fallback to first stock row
  let row = candidates[0];
  const warehouseId = JSON.parse(localStorage.getItem("warehouse") || "{}")?.id ?? null;
  
  if (warehouseId != null) {
    row =
      candidates.find(
        (s) => Number(s.warehouse) === Number(warehouseId)
      ) || row;
  } else {
    row = candidates.find((s) => s.warehouse != null) || row;
  }

  const qty =
    row.quantity_available ??
    row.quantity_available_pcs ??
    row.quantity ??
    row.current_stock ??
    0;

  console.log("👉 Returning current stock for", productName, ":", qty);
  return Number(qty) || 0;
};




  // 5) Holiday handlers
  const handleAddHoliday = async (holiday) => {
    try {
      const res = await api.post(
        "/holidays/",
        { name: holiday.name, date: holiday.date },
        authHeaders() // ✅ api.post
      );
      setHolidays((prev) => [...prev, res.data]);
    } catch (err) {
      console.error("❌ Failed to create holiday:", err);
    }
  };

  const handleRemoveHoliday = async (id) => {
    try {
      await api.delete(`/holidays/${id}/`, authHeaders()); // ✅ api.delete
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      console.error("❌ Failed to remove holiday:", err);
    }
  };

  // 6) Derived UI data
  const productNames = products.map(
    (p) => p.product_name || p.name || p.product
  );

  const overview = useMemo(() => {
    if (!bestSellerData.length) {
      return {
        totalPredictedSales: 0,
        topSellingProduct: "—",
        highestGrowthProduct: "—",
      };
    }

    const totalPredictedSales = bestSellerData.reduce(
      (sum, item) => sum + (item.projectedSales || 0),
      0
    );

    const topSellingProduct = bestSellerData[0]?.product || "—";
    const highestGrowthProduct = bestSellerData[0]?.product || "—";

    return {
      totalPredictedSales,
      topSellingProduct,
      highestGrowthProduct,
    };
  }, [bestSellerData]);

  const seasonalInsights = useMemo(() => {
    if (!forecastData.length) {
      return {
        weeklyPeakDay: "–",
        yearlyPeakMonth: "–",
        trendDirection: "Stable",
        mape: 0,
      };
    }

    const getDate = (row) => new Date(row.date || row.ds);

    const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklySums = new Array(7).fill(0);

    forecastData.forEach((row) => {
      const d = getDate(row);
      const value = Number(row.forecast || 0);
      const dow = d.getDay();
      weeklySums[dow] += value;
    });

    const peakDow = weeklySums.indexOf(Math.max(...weeklySums));
    const weeklyPeakDay = weekdayNames[peakDow];

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthSums = new Array(12).fill(0);

    forecastData.forEach((row) => {
      const d = getDate(row);
      const value = Number(row.forecast || 0);
      const m = d.getMonth();
      monthSums[m] += value;
    });

    const peakMonthIdx = monthSums.indexOf(Math.max(...monthSums));
    const yearlyPeakMonth = monthNames[peakMonthIdx];

    const first = Number(forecastData[0].forecast || 0);
    const last = Number(
      forecastData[forecastData.length - 1].forecast || 0
    );
    const diff = last - first;
    const threshold = first * 0.05;

    let trendDirection = "Stable";
    if (diff > threshold) trendDirection = "Increasing";
    else if (diff < -threshold) trendDirection = "Decreasing";

    let mape = null;
    let mapeCount = 0;
    let mapeSum = 0;

    forecastData.forEach((row) => {
      const actual =
        row.actual != null
          ? Number(row.actual)
          : row.y != null
          ? Number(row.y)
          : row.real != null
          ? Number(row.real)
          : null;

      const pred = Number(row.forecast || 0);

      if (actual && actual !== 0) {
        const ape = Math.abs((actual - pred) / actual);
        mapeSum += ape;
        mapeCount += 1;
      }
    });

    if (mapeCount > 0) {
      mape = (mapeSum / mapeCount) * 100;
    }

    return {
      weeklyPeakDay,
      yearlyPeakMonth,
      trendDirection,
      mape: mape ? mape.toFixed(2) : 0,
    };
  }, [forecastData]);

  // 7) Render
  return (
    <div className="space-y-6">
      <ForecastOverviewCards {...overview} />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mt-2">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Generate Forecast
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Select a product to view its sales forecast and predictions
        </p>

        <ProductSelector
          products={productNames.length ? productNames : ["No products"]}
          selectedProduct={selectedProductName}
          onChange={(name) => setSelectedProductName(name)}
          onGenerate={() => handleGenerateForecast(30)}
        />

        <div className="mt-3">
          <button
            onClick={() => handleGenerateForecast(30)}
            disabled={generating}
            className="inline-flex items-center justify-center rounded-xl bg-red-500 text-white px-4 py-2 text-sm"
          >
            {generating ? "Generating..." : "Generate Forecast (30d)"}
          </button>
          {error && <div className="text-red-600 mt-2">{error}</div>}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {loading ? (
          <div>Loading forecasts…</div>
        ) : (
          <ForecastChart product={selectedProductName} data={forecastData} />
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <ForecastTable product={selectedProductName} data={forecastData} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <BestSellerRanking data={bestSellerData} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <InventoryRecommendations data={inventoryData} />
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <SeasonalInsights insights={seasonalInsights} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <HolidayCalendar
          holidays={holidays}
          onAddHoliday={handleAddHoliday}
          onRemoveHoliday={handleRemoveHoliday}
        />
      </div>
    </div>
  );
}
