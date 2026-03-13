// src/utils/stockThresholds.js
export const getStockThresholds = () => {
  const defaultThresholds = {
    low_threshold: 10,
    moderate_threshold: 50,
    high_threshold: 100,
  };

  try {
    const saved = localStorage.getItem("stockThresholds");
    return saved ? { ...defaultThresholds, ...JSON.parse(saved) } : defaultThresholds;
  } catch (error) {
    console.warn("Error loading stock thresholds:", error);
    return defaultThresholds;
  }
};

export const normalizeStockQuantity = (quantity) => {
  const parsed = Number.parseInt(quantity ?? 0, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const STOCK_STATUS_ORDER = {
  "Out of Stock": 0,
  Low: 1,
  Moderate: 2,
  High: 3,
};

export const calculateStockStatus = (quantity) => {
  const thresholds = getStockThresholds();

  const normalizedQuantity = normalizeStockQuantity(quantity);

  if (normalizedQuantity === 0) return "Out of Stock";
  if (normalizedQuantity <= thresholds.low_threshold) return "Low";
  if (normalizedQuantity <= thresholds.moderate_threshold) return "Moderate";
  if (normalizedQuantity <= thresholds.high_threshold) return "High";
  return "High"; // For quantities above high threshold
};

export const applyStockThresholds = (stocksData = []) =>
  (Array.isArray(stocksData) ? stocksData : []).map((item) => {
    const quantity = normalizeStockQuantity(item?.quantity_available);

    return {
      ...item,
      quantity_available: quantity,
      stock_status: calculateStockStatus(quantity),
    };
  });

export const groupStocksForDisplay = (stocksData = []) =>
  Object.values(
    applyStockThresholds(stocksData).reduce((acc, stock) => {
      const key = String(stock?.product_name || "Unknown Product");

      if (!acc[key]) {
        acc[key] = {
          ...stock,
          product_name: key,
          quantity_available: 0,
          grouped_count: 0,
          system_codes: [],
        };
      }

      acc[key].quantity_available += normalizeStockQuantity(stock?.quantity_available);
      acc[key].grouped_count += 1;

      if (
        stock?.system_product_code &&
        !acc[key].system_codes.includes(stock.system_product_code)
      ) {
        acc[key].system_codes.push(stock.system_product_code);
      }

      if (stock?.last_updated) {
        const currentDate = new Date(stock.last_updated);
        const groupedDate = new Date(acc[key].last_updated || 0);

        if (currentDate > groupedDate) {
          acc[key].last_updated = stock.last_updated;
        }
      }

      acc[key].stock_status = calculateStockStatus(acc[key].quantity_available);
      return acc;
    }, {})
  ).sort((a, b) => {
    const statusDiff =
      (STOCK_STATUS_ORDER[a.stock_status] ?? Number.MAX_SAFE_INTEGER) -
      (STOCK_STATUS_ORDER[b.stock_status] ?? Number.MAX_SAFE_INTEGER);

    if (statusDiff !== 0) {
      return statusDiff;
    }

    return String(a.product_name || "").localeCompare(String(b.product_name || ""));
  });
