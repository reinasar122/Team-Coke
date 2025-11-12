// utils/validators.js
/**
 * Validate a Philippine 11-digit phone number.
 * @param {string} phone
 * @returns {string|null} Error message or null if valid.
 */
export const validatePhoneNumber = (phone) => {
  if (!phone) return "Phone number is required.";
  if (!/^\d+$/.test(phone)) return "Phone number must contain only numbers.";
  if (phone.length !== 11) return "Phone number must be exactly 11 digits long.";
  return null;
};

/**
 * Validate a 4-digit Philippine ZIP/postal code.
 * @param {string} zip
 * @returns {string|null} Error message or null if valid.
 */
export const validateZipCode = (zip) => {
  if (!zip) return "ZIP code is required.";
  if (!/^\d+$/.test(zip)) return "ZIP code must contain only numbers.";
  if (zip.length !== 4) return "ZIP code must be exactly 4 digits long.";
  return null;
};