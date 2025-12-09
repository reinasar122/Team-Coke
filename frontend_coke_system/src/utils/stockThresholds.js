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

export const calculateStockStatus = (quantity) => {
  const thresholds = getStockThresholds();
  
  if (quantity === 0) return "Out of Stock";
  if (quantity <= thresholds.low_threshold) return "Low";
  if (quantity <= thresholds.moderate_threshold) return "Moderate"; 
  if (quantity <= thresholds.high_threshold) return "High";
  return "High"; // For quantities above high threshold
};