// src/utils/formatLKR.js
// Formats a number to Sri Lankan Rupee display format: Rs. X,XXX/-
// Usage: formatLKR(2500) → "Rs. 2,500/-"
//        formatLKR(12500) → "Rs. 12,500/-"
//        formatLKR(0) → "Rs. 0/-"

export const formatLKR = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Rs. 0/-';
  const rounded = Math.round(Number(amount));
  const formatted = rounded.toLocaleString('en-IN');
  return `Rs. ${formatted}/-`;
};