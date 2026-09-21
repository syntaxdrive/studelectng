/**
 * Nigerian Phone Number Normalizer & Validator
 * 
 * Enforces Nigerian phone number constraints:
 * - Local mobile numbers must be exactly 11 digits (e.g., 08012345678).
 * - Valid Nigerian mobile prefix bands: 070, 080, 081, 090, 091 (starts with 07, 08, 09).
 * - International formats (+2348012345678 or 2348012345678) are normalized to the standard 11-digit local format (08012345678).
 * - Numbers where Excel dropped the leading 0 (e.g. 10 digits starting with 7, 8, 9: "8012345678") are normalized to 11 digits ("08012345678").
 * - Strictly rejects any input with less than 11 digits or more than 11 digits.
 */

export interface NormalizedPhoneResult {
  raw: string;
  normalized: string; // 11-digit local format: "08012345678"
  isValid: boolean;
  digitCount: number;
  error?: string;
}

export function validateAndNormalizeNigerianPhone(
  rawInput: string | number | undefined | null
): NormalizedPhoneResult {
  if (rawInput === undefined || rawInput === null) {
    return {
      raw: "",
      normalized: "",
      isValid: false,
      digitCount: 0,
      error: "Phone / WhatsApp number is compulsory. Please enter your active phone number.",
    };
  }

  const raw = String(rawInput).trim();
  if (!raw) {
    return {
      raw: "",
      normalized: "",
      isValid: false,
      digitCount: 0,
      error: "Phone / WhatsApp number is compulsory. Please enter your active phone number.",
    };
  }

  // Strip out common formatting characters: spaces, hyphens, parentheses, periods, slashes
  let cleaned = raw.replace(/[\s\-\(\)\.\/\\]/g, "");

  // Handle +234 or 234 country code
  if (cleaned.startsWith("+234")) {
    cleaned = "0" + cleaned.substring(4);
  } else if (cleaned.startsWith("234") && cleaned.length === 13) {
    cleaned = "0" + cleaned.substring(3);
  } else if (cleaned.length === 10 && /^[789]\d{9}$/.test(cleaned)) {
    // Handle spreadsheet artifact where Excel stripped leading 0 from 080.../070.../090...
    cleaned = "0" + cleaned;
  }

  // Extract all numeric digits
  const digitsOnly = cleaned.replace(/\D/g, "");
  const digitCount = digitsOnly.length;

  // Check for non-digit characters in the cleaned string
  if (cleaned !== digitsOnly) {
    return {
      raw,
      normalized: digitsOnly,
      isValid: false,
      digitCount,
      error: "Phone number must contain only numeric digits.",
    };
  }

  // Length check: No less than 11 digits
  if (digitCount < 11) {
    return {
      raw,
      normalized: digitsOnly,
      isValid: false,
      digitCount,
      error: `Phone number has ${digitCount} digits. A Nigerian phone number must be exactly 11 digits (e.g. 08012345678).`,
    };
  }

  // Length check: No more than 11 digits
  if (digitCount > 11) {
    return {
      raw,
      normalized: digitsOnly,
      isValid: false,
      digitCount,
      error: `Phone number has ${digitCount} digits. A Nigerian phone number must not exceed 11 digits (e.g. 08012345678).`,
    };
  }

  // Prefix check: Must start with 07, 08, or 09
  if (!/^0[789]\d{9}$/.test(digitsOnly)) {
    return {
      raw,
      normalized: digitsOnly,
      isValid: false,
      digitCount,
      error: "Please enter a valid Nigerian mobile phone number starting with 070, 080, 081, 090, or 091.",
    };
  }

  return {
    raw,
    normalized: digitsOnly,
    isValid: true,
    digitCount: 11,
  };
}
