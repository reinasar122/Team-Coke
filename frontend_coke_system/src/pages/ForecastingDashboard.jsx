// src/pages/ForecastingDashboard.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { ForecastOverviewCards } from "../components/forecasting/ForecastOverviewCards";
import { ProductSelector } from "../components/forecasting/ProductSelector";
import { ForecastChart } from "../components/forecasting/ForecastChart";
import { ForecastTable } from "../components/forecasting/ForecastTable";
import { BestSellerRanking } from "../components/forecasting/BestSellerRanking";
import { InventoryRecommendations } from "../components/forecasting/InventoryRecommendations";
import { SeasonalInsights } from "../components/forecasting/SeasonalInsights";
import { HolidayCalendar } from "../components/forecasting/HolidayCalendar";
import api from "../api";
import { getCurrentWarehouse } from "../utils/warehouseUtils";
import { FaChartLine } from "react-icons/fa";
import "../styles/pages/forecasting.scss";

const extractList = (data) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDateFromKey = (dateKey) => {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return new Date(year, month - 1, day);
};

const toMonthKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getMonthDateFromKey = (monthKey) => {
  const [year, month] = String(monthKey).split("-").map(Number);
  return new Date(year, (month || 1) - 1, 1);
};

const formatForecastMonth = (monthKey) => {
  if (!monthKey) return "No month";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(getMonthDateFromKey(monthKey));
};

const getRowDateKey = (row) => String(row.date || row.ds || "").slice(0, 10);

const getNextYearSameDateKey = () => {
  const today = new Date();
  return toDateKey(
    new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
  );
};

const getNextMonthKey = () => {
  const today = new Date();
  return toMonthKey(new Date(today.getFullYear(), today.getMonth() + 1, 1));
};

const getForecastDaysForTarget = (dateKey) => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = getDateFromKey(dateKey);
  const diffDays = Math.ceil((target.getTime() - start.getTime()) / DAY_MS);
  return Math.max(30, diffDays);
};

const formatForecastDate = (dateKey) => {
  if (!dateKey) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(getDateFromKey(dateKey));
};

const getProductName = (product) =>
  product?.product_name || product?.name || product?.product || "";

const forecastCoversDate = (rows, dateKey) =>
  (rows || []).some((row) => getRowDateKey(row) >= dateKey);

const getNext30ForecastTotal = (rows) => {
  const todayKey = toDateKey(new Date());
  const futureRows = (rows || []).filter((row) => getRowDateKey(row) >= todayKey);
  const sourceRows = futureRows.length ? futureRows : rows || [];

  return sourceRows
    .slice(0, 30)
    .reduce((sum, row) => sum + Number(row.forecast || 0), 0);
};

const getSpeedCategory = (forecast30) => {
  if (forecast30 > 1000) return "fast";
  if (forecast30 > 300) return "stable";
  return "slow";
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

const aggregateForecastRowsByMonth = (rows) => {
  const buckets = new Map();

  (rows || []).forEach((row) => {
    const rowDateKey = getRowDateKey(row);
    if (!rowDateKey) return;

    const monthKey = toMonthKey(getDateFromKey(rowDateKey));
    if (!monthKey) return;

    const existing =
      buckets.get(monthKey) || {
        periodKey: monthKey,
        date: formatForecastMonth(monthKey),
        forecast: 0,
        lower: 0,
        upper: 0,
        actual: null,
      };

    existing.forecast += Number(row.forecast || 0);
    existing.lower += Number(row.lower || 0);
    existing.upper += Number(row.upper || 0);

    const actual = row.actual != null ? Number(row.actual) : null;
    if (Number.isFinite(actual)) {
      existing.actual = (existing.actual ?? 0) + actual;
    }

    buckets.set(monthKey, existing);
  });

  return [...buckets.values()].sort((a, b) =>
    String(a.periodKey).localeCompare(String(b.periodKey))
  );
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
  const [forecastBasis, setForecastBasis] = useState("monthly");

  // NEW: stocks from backend
  const [stocks, setStocks] = useState([]);
  const currentWarehouse = useMemo(() => getCurrentWarehouse(), []);
  const warehouseId = currentWarehouse?.id ?? null;
  const targetForecastDate = useMemo(() => getNextYearSameDateKey(), []);

  // -----------------------
  // 1) Fetch product list
  // -----------------------
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await api.get("products/", {
          params: warehouseId ? { warehouse_id: warehouseId } : {},
        });
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
        console.error("Failed to load products:", err);
        const msg =
          err.response?.data?.detail ||
          err.message ||
          "Failed to load products";
        setError(msg);
      }
    };

    fetchProducts();
  }, [warehouseId]);

  // -----------------------
  // 1b) Fetch stocks
  // -----------------------
  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const res = await api.get("stocks/", {
          params: warehouseId ? { warehouse: warehouseId } : {},
        });
        console.log("/api/stocks/ response:", res.data);

        const data = res.data;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.results)
          ? data.results
          : [];

        console.log("Parsed stocks list:", list);
        setStocks(list);
      } catch (err) {
        console.error("Failed to load stocks:", err);
      }
    };

    fetchStocks();
  }, [warehouseId]);

  // Build a fast lookup map: productId -> quantity
  const getCurrentStock = useCallback((productName) => {
    if (!productName || !stocks.length) return 0;
    const normalized = productName.trim().toLowerCase();

    const candidates = stocks.filter(
      (s) =>
        s.product_name &&
        s.product_name.trim().toLowerCase() === normalized
    );

    if (!candidates.length) {
      console.log("No stock rows for", productName, "stocks:", stocks);
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
  }, [stocks, warehouseId]);

  // -----------------------
  // 2) Fetch HOLIDAYS
  // -----------------------
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const res = await api.get("holidays/");
        setHolidays(extractList(res.data));
      } catch (err) {
        console.error("Failed to load holidays:", err);
      }
    };

    fetchHolidays();
  }, []);

  // Fetch or generate forecasts for selected product
  useEffect(() => {
    if (!selectedProductName || !products.length) return;

    let cancelled = false;

    const matchingProducts = products.filter(
      (product) => getProductName(product) === selectedProductName
    );

    const isNoSalesHistoryError = (err) =>
      String(err.response?.data?.detail || err.message || "")
        .toLowerCase()
        .includes("no sales history");

    const fetchRowsForProduct = async (product) => {
      const params = {
        product_id: product.id,
        ...(warehouseId ? { warehouse_id: warehouseId } : {}),
      };
      const res = await api.get("forecasts/", { params });
      return extractList(res.data);
    };

    const generateRowsForProduct = async (product) => {
      await api.post("forecasts/generate/", {
        product: product.id,
        days: getForecastDaysForTarget(targetForecastDate),
        target_date: targetForecastDate,
        warehouse_id: warehouseId,
      });
      return fetchRowsForProduct(product);
    };

    const fetchForecastForSelectedProduct = async () => {
      setLoading(true);
      setGenerating(false);
      setError(null);

      try {
        if (!matchingProducts.length) {
          if (!cancelled) setForecastData([]);
          return;
        }

        const forecastCoversTarget = (rows) =>
          rows.some((row) => getRowDateKey(row) >= targetForecastDate);

        let raw = [];
        let productToGenerate = matchingProducts[0];

        for (const product of matchingProducts) {
          const productRows = await fetchRowsForProduct(product);
          if (!productRows.length) continue;

          raw = productRows;
          productToGenerate = product;
          if (forecastCoversTarget(productRows)) break;
        }

        if (!raw.length || !forecastCoversTarget(raw)) {
          setGenerating(true);

          const productsToTry = raw.length ? [productToGenerate] : matchingProducts;

          for (const product of productsToTry) {
            try {
              raw = await generateRowsForProduct(product);
              if (raw.length && forecastCoversTarget(raw)) break;
            } catch (generateErr) {
              if (!isNoSalesHistoryError(generateErr)) throw generateErr;
            }
          }
        }

        if (!cancelled) {
          setForecastData(normalizeForecastRows(raw));
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch or generate forecasts:", err);
        if (!isNoSalesHistoryError(err)) {
          const msg =
            err.response?.data?.detail ||
            err.message ||
            "Failed to fetch or generate forecasts from API";
          setError(msg);
        }
        setForecastData([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setGenerating(false);
        }
      }
    };

    fetchForecastForSelectedProduct();

    return () => {
      cancelled = true;
    };
  }, [selectedProductName, products, warehouseId, targetForecastDate]);

  // -----------------------
  // 3) Auto-sync forecasts for all current-warehouse products
  // -----------------------
  useEffect(() => {
    if (!products.length) return;

    let cancelled = false;

    const isNoSalesHistoryError = (err) =>
      String(err.response?.data?.detail || err.message || "")
        .toLowerCase()
        .includes("no sales history");

    const fetchRowsForProduct = async (product) => {
      const res = await api.get("forecasts/", {
        params: {
          product_id: product.id,
          ...(warehouseId ? { warehouse_id: warehouseId } : {}),
        },
      });
      return extractList(res.data);
    };

    const generateRowsForProduct = async (product) => {
      await api.post("forecasts/generate/", {
        product: product.id,
        days: getForecastDaysForTarget(targetForecastDate),
        target_date: targetForecastDate,
        warehouse_id: warehouseId,
      });
      return fetchRowsForProduct(product);
    };

    const syncForecastsForAllProducts = async () => {
      try {
        const allInventoryData = [];
        const ranking = [];

        for (const product of products) {
          const productName = getProductName(product);
          if (!productName || product.id == null) continue;

          let forecasts = await fetchRowsForProduct(product);

          if (!forecastCoversDate(forecasts, targetForecastDate)) {
            try {
              forecasts = await generateRowsForProduct(product);
            } catch (generateErr) {
              if (!isNoSalesHistoryError(generateErr)) throw generateErr;
              forecasts = [];
            }
          }

          const normalizedForecasts = normalizeForecastRows(forecasts);
          const total30DayForecast = getNext30ForecastTotal(normalizedForecasts);
          const currentStock = getCurrentStock(productName);
          const restockNeeded = Math.max(total30DayForecast - currentStock, 0);

          allInventoryData.push({
            product: productName,
            forecast30Day: total30DayForecast,
            currentStock,
            restock: restockNeeded,
          });

          if (total30DayForecast > 0) {
            ranking.push({
              product: productName,
              projectedSales: total30DayForecast,
              speedCategory: getSpeedCategory(total30DayForecast),
            });
          }
        }

        ranking.sort((a, b) => b.projectedSales - a.projectedSales);

        if (!cancelled) {
          setInventoryData(allInventoryData);
          setBestSellerData(ranking);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to sync all product forecasts:", err);
        const msg =
          err.response?.data?.detail ||
          err.message ||
          "Failed to sync product forecasts from API";
        setError(msg);
      }
    };

    syncForecastsForAllProducts();

    return () => {
      cancelled = true;
    };
  }, [products, warehouseId, targetForecastDate, getCurrentStock]);

  // Selected product chart and AI suggestion use forecastData directly.
  // Ranking and inventory stay warehouse-wide through the auto-sync above.

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
      console.error("Failed to create holiday:", err);
    }
  };

  const handleRemoveHoliday = async (id) => {
    try {
      await api.delete(`holidays/${id}/`);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      console.error("Failed to remove holiday:", err);
    }
  };

  // -----------------------
  // 6) Derived UI data
  // -----------------------
  const productNames = Array.from(
    new Set(
      products
        .map((p) => p.product_name || p.name || p.product)
        .filter(Boolean)
    )
  );

  const overview = useMemo(() => {
    if (!bestSellerData.length) {
      return {
        totalPredictedSales: 0,
        topSellingProduct: "No data yet",
        highestGrowthProduct: "No data yet",
      };
    }

    const totalPredictedSales = bestSellerData.reduce(
      (sum, item) => sum + (item.projectedSales || 0),
      0
    );

    const topSellingProduct = bestSellerData[0]?.product || "No data yet";
    const highestGrowthProduct = bestSellerData[0]?.product || "No data yet";

    return {
      totalPredictedSales,
      topSellingProduct,
      highestGrowthProduct,
    };
  }, [bestSellerData]);

  const monthlyForecastData = useMemo(
    () => aggregateForecastRowsByMonth(forecastData),
    [forecastData]
  );

  const displayForecastData = useMemo(
    () => (forecastBasis === "monthly" ? monthlyForecastData : forecastData),
    [forecastBasis, monthlyForecastData, forecastData]
  );

  const seasonalInsights = useMemo(() => {
    if (!displayForecastData.length) {
      return {
        primaryPeakLabel:
          forecastBasis === "monthly" ? "Peak Forecast Month" : "Weekly Peak Day",
        primaryPeakValue: "No data yet",
        secondaryPeakLabel:
          forecastBasis === "monthly" ? "Recurring Peak Month" : "Yearly Peak Month",
        secondaryPeakValue: "No data yet",
        trendDirection: "Stable",
        forecastAccuracy: null,
        mapeError: null,
        comparableDays: 0,
        comparableUnit: forecastBasis === "monthly" ? "month" : "day",
      };
    }

    const getDate = (row) => new Date(row.date || row.ds);
    const sortedForecastRows = [...displayForecastData].sort(
      (a, b) => getDate(a).getTime() - getDate(b).getTime()
    );

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
    let primaryPeakLabel = "Weekly Peak Day";
    let primaryPeakValue = "No data yet";
    let secondaryPeakLabel = "Yearly Peak Month";
    let secondaryPeakValue = "No data yet";

    if (forecastBasis === "monthly") {
      const peakMonthRow = sortedForecastRows.reduce((best, row) =>
        Number(row.forecast || 0) > Number(best?.forecast || 0) ? row : best,
      null);

      const recurringMonthSums = new Array(12).fill(0);
      sortedForecastRows.forEach((row) => {
        const d = getDate(row);
        recurringMonthSums[d.getMonth()] += Number(row.forecast || 0);
      });

      const recurringPeakMonthIdx = recurringMonthSums.indexOf(
        Math.max(...recurringMonthSums)
      );

      primaryPeakLabel = "Peak Forecast Month";
      primaryPeakValue = peakMonthRow?.date || "No data yet";
      secondaryPeakLabel = "Recurring Peak Month";
      secondaryPeakValue = monthNames[recurringPeakMonthIdx] || "No data yet";
    } else {
      const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const weeklySums = new Array(7).fill(0);

      sortedForecastRows.forEach((row) => {
        const d = getDate(row);
        const value = Number(row.forecast || 0);
        const dow = d.getDay();
        weeklySums[dow] += value;
      });

      const peakDow = weeklySums.indexOf(Math.max(...weeklySums));

      const monthSums = new Array(12).fill(0);
      sortedForecastRows.forEach((row) => {
        const d = getDate(row);
        const value = Number(row.forecast || 0);
        const m = d.getMonth();
        monthSums[m] += value;
      });

      const peakMonthIdx = monthSums.indexOf(Math.max(...monthSums));
      primaryPeakValue = weekdayNames[peakDow];
      secondaryPeakValue = monthNames[peakMonthIdx];
    }

    const first = Number(sortedForecastRows[0].forecast || 0);
    const last = Number(
      sortedForecastRows[sortedForecastRows.length - 1].forecast || 0
    );
    const diff = last - first;
    const threshold = first * 0.05;

    let trendDirection = "Stable";
    if (diff > threshold) trendDirection = "Increasing";
    else if (diff < -threshold) trendDirection = "Decreasing";

    let comparableDays = 0;
    let mapeErrorSum = 0;

    sortedForecastRows.forEach((row) => {
      const actual =
        row.actual != null
          ? Number(row.actual)
          : row.y != null
          ? Number(row.y)
          : row.real != null
          ? Number(row.real)
          : null;

      const pred = Number(row.forecast || 0);

      if (Number.isFinite(actual) && Number.isFinite(pred) && actual > 0) {
        const ape = Math.abs((actual - pred) / actual) * 100;
        mapeErrorSum += ape;
        comparableDays += 1;
      }
    });

    const mapeError =
      comparableDays > 0 ? mapeErrorSum / comparableDays : null;
    const forecastAccuracy =
      mapeError != null ? Math.max(0, 100 - Math.min(mapeError, 100)) : null;

    return {
      primaryPeakLabel,
      primaryPeakValue,
      secondaryPeakLabel,
      secondaryPeakValue,
      trendDirection,
      forecastAccuracy,
      mapeError,
      comparableDays,
      comparableUnit: forecastBasis === "monthly" ? "month" : "day",
    };
  }, [displayForecastData, forecastBasis]);

  const aiSuggestion = useMemo(() => {
    if (forecastBasis === "monthly") {
      if (!monthlyForecastData.length) return null;

      const targetMonthKey = getNextMonthKey();
      const targetRow =
        monthlyForecastData.find((row) => String(row.periodKey) >= targetMonthKey) ||
        monthlyForecastData[monthlyForecastData.length - 1];

      if (!targetRow) return null;

      const actualRows = monthlyForecastData
        .filter((row) => row.actual != null && Number(row.actual) > 0)
        .sort((a, b) => String(a.periodKey).localeCompare(String(b.periodKey)));

      const sameMonthRows = actualRows.filter(
        (row) => String(row.periodKey).slice(5) === String(targetRow.periodKey).slice(5)
      );
      const basisRows = sameMonthRows.length ? sameMonthRows : actualRows.slice(-3);
      const basisAverage = basisRows.length
        ? Math.round(
            basisRows.reduce((sum, row) => sum + Number(row.actual || 0), 0) /
              basisRows.length
          )
        : null;

      const latestBasis = basisRows[basisRows.length - 1] || null;
      const sameMonthLabel = new Intl.DateTimeFormat("en-US", {
        month: "short",
      }).format(getMonthDateFromKey(targetRow.periodKey));

      return {
        targetLabel: targetRow.date,
        forecast: Math.round(Number(targetRow.forecast || 0)),
        lower: Math.round(Number(targetRow.lower || 0)),
        upper: Math.round(Number(targetRow.upper || 0)),
        basisAverage,
        basisLabel: sameMonthRows.length
          ? `previous ${sameMonthLabel} monthly sales`
          : "latest monthly history",
        latestBasisDate: latestBasis ? latestBasis.date : null,
        latestBasisActual: latestBasis
          ? Math.round(Number(latestBasis.actual || 0))
          : null,
        unitContext: "for the month",
      };
    }

    if (!forecastData.length || !targetForecastDate) return null;

    const targetRow = forecastData.find(
      (row) => getRowDateKey(row) === targetForecastDate
    );
    if (!targetRow) return null;

    const actualRows = forecastData
      .filter(
        (row) => row.actual != null && Number(row.actual) > 0 && row.date
      )
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const targetDate = getDateFromKey(targetForecastDate);
    const sameDateRows = actualRows.filter(
      (row) => String(row.date).slice(5) === targetForecastDate.slice(5)
    );
    const sameWeekdayRows = actualRows.filter(
      (row) => getDateFromKey(row.date).getDay() === targetDate.getDay()
    );
    const basisRows = sameDateRows.length
      ? sameDateRows
      : sameWeekdayRows.length
      ? sameWeekdayRows
      : actualRows.slice(-3);

    const basisAverage = basisRows.length
      ? Math.round(
          basisRows.reduce((sum, row) => sum + Number(row.actual || 0), 0) /
            basisRows.length
        )
      : null;

    const weekdayLabel = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
    }).format(targetDate);
    const monthDayLabel = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
    }).format(targetDate);
    const latestBasis = basisRows[basisRows.length - 1] || null;

    const basisLabel = sameDateRows.length
      ? `previous ${monthDayLabel} sales`
      : sameWeekdayRows.length
      ? `previous ${weekdayLabel} sales`
      : "latest sales history";

    return {
      targetLabel: formatForecastDate(targetForecastDate),
      forecast: Math.round(Number(targetRow.forecast || 0)),
      lower: Math.round(Number(targetRow.lower || 0)),
      upper: Math.round(Number(targetRow.upper || 0)),
      basisAverage,
      basisLabel,
      latestBasisDate: latestBasis ? formatForecastDate(latestBasis.date) : null,
      latestBasisActual: latestBasis
        ? Math.round(Number(latestBasis.actual || 0))
        : null,
      unitContext: "for the day",
    };
  }, [forecastBasis, monthlyForecastData, forecastData, targetForecastDate]);

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
            Product Forecast
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

        {aiSuggestion && (
          <div className="forecasting-page__panel forecasting-page__suggestion-panel">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  AI Sales Suggestion
                </p>
                <h2 className="mt-1 text-xl font-semibold text-gray-900">
                  {aiSuggestion.targetLabel}: {aiSuggestion.forecast} pcs
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Expected range: {aiSuggestion.lower} to {aiSuggestion.upper} pcs {aiSuggestion.unitContext}.
                </p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 md:max-w-xl">
                {aiSuggestion.basisAverage != null ? (
                  <p>
                    Based on {aiSuggestion.basisLabel}, the average was {" "}
                    <strong>{aiSuggestion.basisAverage} pcs</strong>
                    {aiSuggestion.latestBasisDate && (
                      <>
                        {" "}
                        with latest match on {aiSuggestion.latestBasisDate} at {" "}
                        <strong>{aiSuggestion.latestBasisActual} pcs</strong>.
                      </>
                    )}
                  </p>
                ) : (
                  <p>Based on available sales history for {selectedProductName}.</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="forecasting-page__panel">
          {loading ? (
            <div className="forecasting-page__loading">Loading forecasts...</div>
          ) : (
            <ForecastChart
              product={selectedProductName}
              data={displayForecastData}
              basis={forecastBasis}
            />
          )}
        </div>

        <div className="forecasting-page__panel">
          <ForecastTable
            product={selectedProductName}
            data={displayForecastData}
            basis={forecastBasis}
          />
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