/**
 * Generate N random recovery codes in format XXXX-XXXX
 */
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  for (let i = 0; i < count; i++) {
    let code = "";
    for (let j = 0; j < 8; j++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    codes.push(code.slice(0, 4) + "-" + code.slice(4));
  }
  return codes;
}

/**
 * Hash a recovery code using SHA-256 (browser-native)
 */
export async function hashCode(code: string): Promise<string> {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
