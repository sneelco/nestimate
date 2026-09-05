export const uid = () => Math.random().toString(36).slice(2, 9);

export const fmtFull = (n) => "$" + Math.round(n).toLocaleString("en-US");

export const fmtAxis = (n) => {
  if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + "M";
  if (Math.abs(n) >= 1e3) return "$" + Math.round(n / 1e3) + "k";
  return "$" + Math.round(n);
};

export const num = (v, fallback = 0) => {
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
};
