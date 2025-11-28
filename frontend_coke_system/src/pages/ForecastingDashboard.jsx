// src/pages/ForecastingDashboard.jsx
import React, { useMemo, useState, useEffect } from "react";
import axios from "axios";

import { ForecastOverviewCards } from "../components/forecasting/ForecastOverviewCards";
import { ProductSelector } from "../components/forecasting/ProductSelector";
import { ForecastChart } from "../components/forecasting/ForecastChart";
import { ForecastTable } from "../components/forecasting/ForecastTable";
import { BestSellerRanking } from "../components/forecasting/BestSellerRanking";
import { InventoryRecommendations } from "../components/forecasting/InventoryRecommendations";
import { SeasonalInsights } from "../components/forecasting/SeasonalInsights";
import { HolidayCalendar } from "../components/forecasting/HolidayCalendar";

// same base you use in other pages
const API_BASE = "http://127.0.0.1:8080/api";

// helper: extract token like your other components
const getToken = () =>
  localStorage.getItem("accessToken") ||
  localStorage.getItem("token") ||
  localStorage.getItem("access");

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



  // =========================
// 1) Fetch product list
// =========================
useEffect(() => {
  const fetchProducts = async () => {
    try {
      // 👇 EXACTLY the same style you used in Product List page
      const res = await axios.get("http://127.0.0.1:8080/api/products/");

      console.log("👉 /api/products/ response:", res.data);

      // handle array OR {results: [...]}
      const data = res.data;
      const list = Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : [];

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


  // =========================
  // 2) Fetch HOLIDAYS
  // =========================
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const token = getToken();

        const res = await axios.get(`${API_BASE}/holidays/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        console.log("👉 /api/holidays/ response:", res.data);

        setHolidays(extractList(res.data));
      } catch (err) {
        console.error("❌ Failed to load holidays:", err);
      }
    };

    fetchHolidays();
  }, []);

  // =========================
  // 3) Fetch FORECASTS when product changes
  // =========================
  useEffect(() => {
    if (!selectedProductName || products.length === 0) return;

    const fetchForecasts = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = getToken();

        const productObj = products.find(
          (p) =>
            (p.product_name || p.name || p.product) === selectedProductName
        );

        if (!productObj) {
          setForecastData([]);
          setLoading(false);
          return;
        }

        const res = await axios.get(`${API_BASE}/forecasts/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          params: { product_id: productObj.id },
        });

        console.log("👉 /api/forecasts/ response:", res.data);

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


  useEffect(() => {
  if (!forecastData.length || !selectedProductName) {
    setBestSellerData([]);
    setInventoryData([]);
    return;
  }

  // 👉 Simple example: sum first 30 days forecast for selected product
  const total30DayForecast = forecastData
    .slice(0, 30)
    .reduce((sum, row) => sum + (row.forecast || 0), 0);

  // 1) Best-seller ranking (for now, only selected product)
  setBestSellerData([
    {
      product: selectedProductName,
      projectedSales: total30DayForecast,
      // simple rule: > 1000 fast, > 300 stable, else slow
      speedCategory:
        total30DayForecast > 1000
          ? "fast"
          : total30DayForecast > 300
          ? "stable"
          : "slow",
    },
  ]);

  // 2) Inventory recommendations (dummy current stock for now)
  const currentStock = 500; // later we can fetch from /stocks/ API

  const restockNeeded = Math.max(total30DayForecast - currentStock, 0);

  setInventoryData([
    {
      product: selectedProductName,
      forecast30Day: total30DayForecast,
      currentStock,
      restock: restockNeeded,
    },
  ]);
}, [forecastData, selectedProductName]);



// =========================
// GLOBAL BEST SELLER + INVENTORY FOR ALL PRODUCTS
// =========================
useEffect(() => {
  const fetchGlobalForecasts = async () => {
    try {
      const token = getToken();

      // Fetch ALL forecasts stored in DB
      const res = await axios.get(`${API_BASE}/forecasts/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const allForecasts = extractList(res.data);
      if (!allForecasts.length) return;

      // Group by product name
      const grouped = {};
      allForecasts.forEach((row) => {
        const pName = row.product_name || row.product;
        if (!grouped[pName]) grouped[pName] = [];
        grouped[pName].push(row);
      });

      // Compute totals per product
      const ranking = [];
      const inventory = [];

      Object.keys(grouped).forEach((name) => {
        const forecast30 = grouped[name]
          .slice(0, 30)
          .reduce((sum, r) => sum + (r.forecast || 0), 0);

        // Category
        let speed = "slow";
        if (forecast30 > 1000) speed = "fast";
        else if (forecast30 > 300) speed = "stable";

        ranking.push({
          product: name,
          projectedSales: forecast30,
          speedCategory: speed,
        });

        // Dummy current stock (replace later if needed)
        const currentStock = 500;
        const restock = Math.max(forecast30 - currentStock, 0);

        inventory.push({
          product: name,
          forecast30Day: forecast30,
          currentStock,
          restock,
        });
      });

      // Sort from highest seller to lowest
      ranking.sort((a, b) => b.projectedSales - a.projectedSales);

      setBestSellerData(ranking);
      setInventoryData(inventory);

    } catch (err) {
      console.log("❌ Global ranking failed:", err);
    }
  };

  fetchGlobalForecasts();
}, [products, forecastData]);



  // =========================
  // 4) Generate FORECAST (Prophet in backend)
  // =========================
  const handleGenerateForecast = async (days = 30) => {
    setGenerating(true);
    setError(null);

    try {
      const token = getToken();

      const productObj = products.find(
        (p) =>
          (p.product_name || p.name || p.product) === selectedProductName
      );

      if (!productObj) {
        setError("Please select a valid product");
        setGenerating(false);
        return;
      }

      const res = await axios.post(
        `${API_BASE}/forecasts/generate/`,
        {
          product: productObj.id,
          days,
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      console.log("👉 /api/forecasts/generate/ response:", res.data);

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

  // =========================
  // 5) Holiday handlers
  // =========================
  const handleAddHoliday = async (holiday) => {
    try {
      const token = getToken();

      const res = await axios.post(
        `${API_BASE}/holidays/`,
        { name: holiday.name, date: holiday.date },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      setHolidays((prev) => [...prev, res.data]);
    } catch (err) {
      console.error("❌ Failed to create holiday:", err);
    }
  };

  const handleRemoveHoliday = async (id) => {
    try {
      const token = getToken();

      await axios.delete(`${API_BASE}/holidays/${id}/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      console.error("❌ Failed to remove holiday:", err);
    }
  };

  // =========================
  // 6) Derived UI data
  // =========================
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

    // Sum of 30-day forecasts across ALL products
    const totalPredictedSales = bestSellerData.reduce(
      (sum, item) => sum + (item.projectedSales || 0),
      0
    );

    // First item in bestSellerData is already the top seller
    const topSellingProduct = bestSellerData[0]?.product || "—";

    // For now we can use the same product for "Highest Growth Trend"
    // (later you can change this to use a real growth metric)
    const highestGrowthProduct = bestSellerData[0]?.product || "—";

    return {
      totalPredictedSales,
      topSellingProduct,
      highestGrowthProduct,
    };
  }, [bestSellerData]);


  // Seasonal insights computed from forecastData
  const seasonalInsights = useMemo(() => {
    if (!forecastData.length) {
      return {
        weeklyPeakDay: "–",
        yearlyPeakMonth: "–",
        trendDirection: "Stable",
        mape: 0, // Default to 0 if no data
      };
    }

    const getDate = (row) => new Date(row.date || row.ds);

    // 1) Weekly peak day (sum of forecast by weekday)
    const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklySums = new Array(7).fill(0);

    forecastData.forEach((row) => {
      const d = getDate(row);
      const value = Number(row.forecast || 0);
      const dow = d.getDay(); // 0–6
      weeklySums[dow] += value;
    });

    const peakDow = weeklySums.indexOf(Math.max(...weeklySums));
    const weeklyPeakDay = weekdayNames[peakDow];

    // 2) Yearly peak month (sum of forecast by month)
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
      const m = d.getMonth(); // 0–11
      monthSums[m] += value;
    });

    const peakMonthIdx = monthSums.indexOf(Math.max(...monthSums));
    const yearlyPeakMonth = monthNames[peakMonthIdx];

    // 3) Trend direction (compare first vs last forecast)
    const first = Number(forecastData[0].forecast || 0);
    const last = Number(forecastData[forecastData.length - 1].forecast || 0);
    const diff = last - first;
    const threshold = first * 0.05; // 5% change threshold

    let trendDirection = "Stable";
    if (diff > threshold) trendDirection = "Increasing";
    else if (diff < -threshold) trendDirection = "Decreasing";

    // 4) MAPE (Mean Absolute Percentage Error)
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
      mape: mape ? mape.toFixed(2) : 0, // Safely handle null or undefined
    };
  }, [forecastData]);



  // =========================
  // 7) Render
  // =========================
  return (
    <div className="space-y-6">
      <ForecastOverviewCards {...overview} />

      {/* Generate Forecast section */}
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

      {/* Forecast chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {loading ? (
          <div>Loading forecasts…</div>
        ) : (
          <ForecastChart product={selectedProductName} data={forecastData} />
        )}
      </div>

      {/* Forecast table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <ForecastTable product={selectedProductName} data={forecastData} />
      </div>

      {/* Best-seller & inventory */}
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


      {/* Holidays */}
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