/**
 * Password Strength & Breach Detection
 *
 * ENFORCES:
 *  - Minimum 12 characters (NIST 800-63B)
 *  - No common patterns (qwerty, password123, etc.)
 *  - Check against HaveIBeenPwned API (safe — only sends hash suffix)
 *  - Clear error messages for users
 *
 * USAGE:
 *  import { validatePassword, getPasswordStrengthError } from "@/lib/password-validation";
 *
 *  const result = await validatePassword("MyP@ssw0rd123!");
 *  if (!result.valid) {
 *    console.error(result.error); // "Password is too common"
 *    return showError(result.error);
 *  }
 *
 *  // Safe to sign up with this password
 *
 * SUPABASE CONFIGURATION:
 *  1. Dashboard → Auth → Policies
 *  2. Enable "Require strong password" (minimum 8, but we enforce 12)
 *  3. Enable "Disallow compromised passwords" → "Block if detected in databases"
 *
 * HOW IT WORKS:
 *  1. Check length (12+ chars)
 *  2. Check entropy/patterns (no "password", "qwerty", etc.)
 *  3. Check against HaveIBeenPwned:
 *     - Take SHA1(password), extract first 5 chars
 *     - Query k-anonymity API: https://api.pwnedpasswords.com/range/PREFIX
 *     - API returns hashes with same prefix; check if full hash is in list
 *     - Your password never leaves your device in plain text
 *     - HaveIBeenPwned never sees your full password
 */

const COMMON_PASSWORDS = [
  "password",
  "123456",
  "password123",
  "qwerty",
  "abc123",
  "monkey",
  "letmein",
  "admin",
  "welcome",
  "login",
  "passw0rd",
  "master",
  "sunshine",
  "football",
  "123456789",
  "shadow",
  "iloveyou",
  "trustno1",
];

interface PasswordValidationResult {
  valid: boolean;
  error?: string;
  score?: number; // 0-5 (5 is best)
}

/**
 * Hash password with SHA1 for HaveIBeenPwned check
 * Note: SHA1 is not for security; it's just for k-anonymity with HIBP API
 */
async function sha1(input: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(input),
  );
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Check if password exists in HaveIBeenPwned database (k-anonymity safe)
 */
async function checkHaveIBeenPwned(password: string): Promise<boolean> {
  try {
    const hash = await sha1(password);
    const prefix = hash.slice(0, 5).toUpperCase();
    const suffix = hash.slice(5).toUpperCase();

    // Query API with only the first 5 chars of hash
    // API returns all hashes starting with that prefix
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!response.ok) {
      // If API fails, allow the password (fail open)
      return false;
    }

    const text = await response.text();
    const hashes = text.split("\r\n");

    // Check if our full hash is in the list
    for (const line of hashes) {
      const [hashSuffix] = line.split(":");
      if (hashSuffix === suffix) {
        return true; // Found in breach database
      }
    }
    return false;
  } catch (err) {
    console.error("HaveIBeenPwned check failed:", err);
    // On error, allow the password (don't block users due to API outage)
    return false;
  }
}

/**
 * Validate password strength
 * Returns { valid: true } or { valid: false, error: "reason" }
 */
export async function validatePassword(
  password: string,
): Promise<PasswordValidationResult> {
  // 1. Check length (minimum 12 characters)
  if (password.length < 12) {
    return {
      valid: false,
      error: "Password must be at least 12 characters long",
    };
  }

  // 2. Check for common passwords
  const lowerPassword = password.toLowerCase();
  for (const common of COMMON_PASSWORDS) {
    if (lowerPassword.includes(common)) {
      return {
        valid: false,
        error: `Password contains a common pattern ("${common}")`,
      };
    }
  }

  // 3. Check HaveIBeenPwned database
  const isBreached = await checkHaveIBeenPwned(password);
  if (isBreached) {
    return {
      valid: false,
      error: "This password has been found in known data breaches. Please choose a different password.",
    };
  }

  // 4. Calculate strength score (0-5)
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;

  return {
    valid: true,
    score,
  };
}

/**
 * Get a user-friendly error message for password validation
 */
export function getPasswordStrengthError(password: string): string | null {
  if (password.length < 12) {
    return "Password must be at least 12 characters";
  }
  for (const common of COMMON_PASSWORDS) {
    if (password.toLowerCase().includes(common)) {
      return "Password is too common — try something unique";
    }
  }
  return null;
}

/**
 * Check password entropy (Shannon entropy)
 * Higher entropy = stronger password
 * Minimum 30 bits recommended
 */
export function calculateEntropy(password: string): number {
  const charset = new Set(password).size;
  const length = password.length;

  // Shannon entropy = log2(charset^length)
  const entropy = length * Math.log2(charset);
  return entropy;
}

/**
 * Get password strength label
 */
export function getPasswordStrengthLabel(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return "Very Weak";
    case 2:
      return "Weak";
    case 3:
      return "Fair";
    case 4:
      return "Good";
    case 5:
      return "Excellent";
    default:
      return "Unknown";
  }
}

/**
 * Real-time password validation for signup form
 * Shows live feedback as user types
 */
export interface PasswordFeedback {
  isValid: boolean;
  score: number;
  label: string;
  suggestions: string[];
}

export async function getPasswordFeedback(
  password: string,
): Promise<PasswordFeedback> {
  const validation = await validatePassword(password);

  const suggestions: string[] = [];
  if (password.length < 12) suggestions.push("Add more characters (aim for 16+)");
  if (!/[A-Z]/.test(password)) suggestions.push("Add uppercase letters");
  if (!/[0-9]/.test(password)) suggestions.push("Add numbers");
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
    suggestions.push("Add special characters");

  return {
    isValid: validation.valid,
    score: validation.score || 0,
    label: getPasswordStrengthLabel(validation.score || 0),
    suggestions: validation.valid ? [] : suggestions,
  };
}
