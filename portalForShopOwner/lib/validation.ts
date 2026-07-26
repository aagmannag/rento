export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidPhone(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value);
}

export function isValidPincode(value: string): boolean {
  return /^\d{6}$/.test(value);
}

export function passwordIssue(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain both letters and numbers";
  }
  return null;
}
