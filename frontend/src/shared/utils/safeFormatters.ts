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

/**
 * Safe helper function for formatting dates to local Kenyan EAT time (UTC+3).
 * Format: 23 Oct 03:00:00 EAT
 */
export function formatDateEAT(dateVal: unknown): string {
  if (!dateVal) return 'N/A';
  try {
    const date = new Date(dateVal as string | number | Date);
    if (isNaN(date.getTime())) return 'N/A';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Nairobi',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
      hour12: false,
    })
      .format(date)
      .replace(',', '')
      .replace('GMT+3', 'EAT')
      .replace('EAT', 'EAT');
  } catch (e) {
    return String(dateVal);
  }
}

/**
 * Safe helper function for formatting KYC document types into human-readable strings.
 */
export const formatDocumentType = (docType?: string): string => {
  if (!docType) return 'National ID';
  const knownMap: Record<string, string> = {
    national_id: 'National ID',
    proof_of_address: 'Proof of Address',
    passport: 'Passport',
    driving_license: 'Driving License',
    drivers_license: "Driver's License",
    selfie: 'Biometric Selfie',
  };
  const key = docType.toLowerCase().trim();
  if (knownMap[key]) return knownMap[key];

  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
