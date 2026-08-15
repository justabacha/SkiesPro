/**
 * Formats a number or string as KES currency.
 * @param amount The amount to format
 * @param includeSymbol Whether to include the 'KES' symbol
 * @returns Formatted currency string
 */
export const formatKES = (amount: number | string, includeSymbol: boolean = true): string => {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(value)) {
    return includeSymbol ? 'KES 0.00' : '0.00';
  }

  const formatted = new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  return includeSymbol ? `KES ${formatted}` : formatted;
};
