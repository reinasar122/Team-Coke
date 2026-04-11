// src/pages/ForecastingDashboard.jsx
import React, { useMemo, useState, useEffect } from "react";

import { ForecastOverviewCards } from "../components/forecasting/ForecastOverviewCards";
import { ProductSelector } from "../components/forecasting/ProductSelector";
import { ForecastChart } from "../components/forecasting/ForecastChart";
import { ForecastTable } from "../components/forecasting/ForecastTable";
import { BestSellerRanking } from "../components/forecasting/BestSellerRanking";
import { InventoryRecommendations } from "../components/forecasting/InventoryRecommendations";
import { SeasonalInsights } from "../components/forecasting/SeasonalInsights";
import { HolidayCalendar } from "../components/forecasting/HolidayCalendar";
import api from "../api"; // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ use shared API instance
import { FaChartLine } from "react-icons/fa";
import "../styles/pages/forecasting.scss";

const extractList = (data) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
};

// Karen Changes: Normalize forecast rows coming from API
const normalizeForecastRows = (rows) =>
  (rows || []).map((r) => ({
    date: r.date || r.ds || "",

    // Forecast band from backend
    forecast: Number(r.forecast ?? r.yhat ?? 0),
    lower: Number(r.lower ?? r.yhat_lower ?? 0),
    upper: Number(r.upper ?? r.yhat_upper ?? 0),

    // Actual sales (attached in ForecastViewSet.list)
    actual:
      r.actual != null
        ? Number(r.actual)
        : r.y != null
        ? Number(r.y)
        : null,
  }));

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

  // NEW: stocks from backend
  const [stocks, setStocks] = useState([]);

  // -----------------------
  // 1) Fetch product list
  // -----------------------
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await api.get("products/");
        const data = res.data;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.results)
          ? data.results
          : [];

        setProducts(list);

        if (list.length > 0) {
          const firstName =
            list[0].product_name || list[0].name || list[0].product;
          setSelectedProductName(firstName);
        }
      } catch (err) {
        console.error("ÃƒÂ¢Ã‚ÂÃ…â€™ Failed to load products:", err);
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
        const res = await api.get("stocks/");
        console.log("ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ¢â‚¬Â° /api/stocks/ response:", res.data);

        const data = res.data;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.results)
          ? data.results
          : [];

        console.log("ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ¢â‚¬Â° parsed stocks list:", list);
        setStocks(list);
      } catch (err) {
        console.error("ÃƒÂ¢Ã‚ÂÃ…â€™ Failed to load stocks:", err);
      }
    };

    fetchStocks();
  }, []);

  // Build a fast lookup map: productId -> quantity
  const stockByProductId = useMemo(() => {
    const map = {};
    stocks.forEach((s) => {
      const id = s.product?.id ?? s.product_id ?? null;
      if (id == null) return;

      const qty =
        s.quantity_available ??
        s.quantity_available_pcs ??
        s.quantity ??
        s.current_stock ??
        0;

      map[Number(id)] = Number(qty) || 0;
    });
    return map;
  }, [stocks]);

  // warehouse id (for picking correct stock row)
  const warehouseId =
    JSON.parse(localStorage.getItem("warehouse") || "{}")?.id ?? null;

  const getCurrentStock = (productName) => {
    if (!productName || !stocks.length) return 0;

    const normalized = productName.trim().toLowerCase();

    const candidates = stocks.filter(
      (s) =>
        s.product_name &&
        s.product_name.trim().toLowerCase() === normalized
    );

    if (!candidates.length) {
      console.log("ÃƒÂ¢Ã‚ÂÃ…â€™ No stock rows for", productName, "stocks:", stocks);
      return 0;
    }

    let row = candidates[0];
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

    return Number(qty) || 0;
  };

  // -----------------------
  // 2) Fetch HOLIDAYS
  // -----------------------
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const res = await api.get("holidays/");
        setHolidays(extractList(res.data));
      } catch (err) {
        console.error("ÃƒÂ¢Ã‚ÂÃ…â€™ Failed to load holidays:", err);
      }
    };

    fetchHolidays();
  }, []);

  // Fetch forecasts for selected product
  useEffect(() => {
    if (!selectedProductName || !products.length) return;

    const fetchForecastForSelectedProduct = async () => {
      setLoading(true);
      setError(null);

      try {
        const productObj = products.find(
          (p) => (p.product_name || p.name || p.product) === selectedProductName
        );

        if (!productObj) {
          setForecastData([]);
          setLoading(false);
          return;
        }

        const res = await api.get("forecasts/", {
          params: { product_id: productObj.id },
        });

        const raw = extractList(res.data);
        const normalized = normalizeForecastRows(raw); // Karen Changes
        setForecastData(normalized);
      } catch (err) {
        console.error("ÃƒÂ¢Ã‚ÂÃ…â€™ Failed to fetch forecasts:", err);
        const msg =
          err.response?.data?.detail ||
          err.message ||
          "Failed to fetch forecasts from API";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchForecastForSelectedProduct();
  }, [selectedProductName, products]);

  // -----------------------
  // 3) Fetch FORECASTS for ALL products (for inventory table)
  // -----------------------
  useEffect(() => {
    if (!products.length) return;

    const fetchForecastsForAllProducts = async () => {
      setLoading(true);
      setError(null);

      try {
        const allInventoryData = [];

        for (const product of products) {
          const res = await api.get("forecasts/", {
            params: { product_id: product.id },
          });

          const forecasts = extractList(res.data);
          const total30DayForecast = forecasts
            .slice(0, 30)
            .reduce((sum, row) => sum + (row.forecast || 0), 0);

          const currentStock = getCurrentStock(product.product_name);
          const restockNeeded = Math.max(total30DayForecast - currentStock, 0);

          allInventoryData.push({
            product: product.product_name,
            forecast30Day: total30DayForecast,
            currentStock,
            restock: restockNeeded,
          });
        }

        setInventoryData(allInventoryData);
      } catch (err) {
        console.error("ÃƒÂ¢Ã‚ÂÃ…â€™ Failed to fetch forecasts:", err);
        const msg =
          err.response?.data?.detail ||
          err.message ||
          "Failed to fetch forecasts from API";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchForecastsForAllProducts();
  }, [products]);

  // -----------------------
  // 3b) Selected product summary + inventory
  // -----------------------
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

    const currentStock = getCurrentStock(selectedProductName);
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

  // -----------------------
  // GLOBAL BEST SELLER (all products)
  // -----------------------
  useEffect(() => {
    const fetchGlobalForecasts = async () => {
      try {
        const res = await api.get("forecasts/");
        const allForecasts = extractList(res.data);
        if (!allForecasts.length) return;

        const grouped = {};
        allForecasts.forEach((row) => {
          const pName = row.product_name || row.product;
          if (!grouped[pName]) grouped[pName] = [];
          grouped[pName].push(row);
        });

        const ranking = [];

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
        });

        ranking.sort((a, b) => b.projectedSales - a.projectedSales);
        setBestSellerData(ranking);
      } catch (err) {
        console.log("ÃƒÂ¢Ã‚ÂÃ…â€™ Global ranking failed:", err);
      }
    };

    fetchGlobalForecasts();
  }, [products, forecastData]);

  // -----------------------
  // 4) Generate FORECAST
  // -----------------------
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

      await api.post("forecasts/generate/", {
        product: productObj.id,
        days,
      });

      // Karen Changes: after generating, re-fetch via GET so we include `actual`
      const res2 = await api.get("forecasts/", {
        params: { product_id: productObj.id },
      });

      const raw2 = extractList(res2.data);
      const normalized2 = normalizeForecastRows(raw2);
      setForecastData(normalized2);
    } catch (err) {
      console.error("ÃƒÂ¢Ã‚ÂÃ…â€™ Generate forecast failed:", err);
      const msg =
        err.response?.data?.detail ||
        err.message ||
        "Generate forecast failed";
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  // -----------------------
  // 5) Holiday handlers
  // -----------------------
  const handleAddHoliday = async (holiday) => {
    try {
      const res = await api.post("holidays/", {
        name: holiday.name,
        date: holiday.date,
      });
      setHolidays((prev) => [...prev, res.data]);
    } catch (err) {
      console.error("ÃƒÂ¢Ã‚ÂÃ…â€™ Failed to create holiday:", err);
    }
  };

  const handleRemoveHoliday = async (id) => {
    try {
      await api.delete(`holidays/${id}/`);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      console.error("ÃƒÂ¢Ã‚ÂÃ…â€™ Failed to remove holiday:", err);
    }
  };

  // -----------------------
  // 6) Derived UI data
  // -----------------------
  const productNames = products.map(
    (p) => p.product_name || p.name || p.product
  );

  const overview = useMemo(() => {
    if (!bestSellerData.length) {
      return {
        totalPredictedSales: 0,
        topSellingProduct: "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â",
        highestGrowthProduct: "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â",
      };
    }

    const totalPredictedSales = bestSellerData.reduce(
      (sum, item) => sum + (item.projectedSales || 0),
      0
    );

    const topSellingProduct = bestSellerData[0]?.product || "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â";
    const highestGrowthProduct = bestSellerData[0]?.product || "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â";

    return {
      totalPredictedSales,
      topSellingProduct,
      highestGrowthProduct,
    };
  }, [bestSellerData]);

  const seasonalInsights = useMemo(() => {
    if (!forecastData.length) {
      return {
        weeklyPeakDay: "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“",
        yearlyPeakMonth: "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“",
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

    // Karen Changes
    if (mapeCount > 0) {
      mape = (mapeSum / mapeCount) * 100;
    } else {
      mape = 0;
    }

    return {
      weeklyPeakDay,
      yearlyPeakMonth,
      trendDirection,
      mape: mape || 0,
    };
  }, [forecastData]);

  // -----------------------
  // 7) Render
  // -----------------------
  return (
    <div className="page forecasting-page">
      <div className="page-header forecasting-page__header">
        <div>
          <h1 className="page-title forecasting-page__title">
            <FaChartLine className="forecasting-page__title-icon" />
            <span>Forecasting</span>
          </h1>
          <p className="forecasting-page__subtitle">
            View demand forecasts, sales trends, and restocking insights.
          </p>
        </div>
      </div>

      <div className="forecasting-page__content">
        {error && (
          <div className="forecasting-page__alert forecasting-page__alert--error">
            {error}
          </div>
        )}

        <div className="forecasting-page__overview">
          <ForecastOverviewCards {...overview} />
        </div>

        <div className="forecasting-page__panel forecasting-page__panel--hero">
          <h2 className="forecasting-page__section-title">
            Generate Forecast
          </h2>
          <p className="forecasting-page__section-copy">
            Select a product to view its sales forecast and predictions.
          </p>

          <ProductSelector
            products={productNames.length ? productNames : ["No products"]}
            selectedProduct={selectedProductName}
            onChange={(name) => setSelectedProductName(name)}
            onGenerate={handleGenerateForecast}
          />
        </div>

        <div className="forecasting-page__panel">
          {loading ? (
            <div className="forecasting-page__loading">Loading forecasts...</div>
          ) : (
            <ForecastChart product={selectedProductName} data={forecastData} />
          )}
        </div>

        <div className="forecasting-page__panel">
          <ForecastTable product={selectedProductName} data={forecastData} />
        </div>

        <div className="forecasting-page__panel">
          <BestSellerRanking data={bestSellerData} />
        </div>

        <div className="forecasting-page__grid">
          <div className="forecasting-page__panel forecasting-page__panel--wide">
            <InventoryRecommendations data={inventoryData} />
          </div>
          <div className="forecasting-page__panel">
            <SeasonalInsights insights={seasonalInsights} />
          </div>
        </div>

        <div className="forecasting-page__panel">
          <HolidayCalendar
            holidays={holidays}
            onAddHoliday={handleAddHoliday}
            onRemoveHoliday={handleRemoveHoliday}
          />
        </div>
      </div>
    </div>
  );
}