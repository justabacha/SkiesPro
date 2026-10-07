/**
 * Safe helper function for formatting numbers/currency.
 * Safeguards against null, undefined, NaN, or non-numeric values.
 */
export const safeFormatNumber = (val: unknown, options?: Intl.NumberFormatOptions): string => {
  const num = Number(val ?? 0);
  return isNaN(num) ? '0.00' : num.toLocaleString(undefined, options);
};

/**
 * Safe helper function for formatting dates.
 * Safeguards against null, undefined, or invalid date values.
 */
export const safeFormatDate = (
  dateVal: unknown,
  options?: { utc?: boolean; timeOnly?: boolean; dateOnly?: boolean }
): string => {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal as string | number | Date);
  if (isNaN(d.getTime())) return 'N/A';
  if (options?.timeOnly) return d.toLocaleTimeString();
  if (options?.dateOnly) return d.toLocaleDateString();
  if (options?.utc) return d.toUTCString();
  return d.toLocaleString();
};
