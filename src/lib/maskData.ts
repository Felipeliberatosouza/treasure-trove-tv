/**
 * Masks a CPF: 123.456.789-00 → ***.456.***-**
 */
export function maskCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return cpf;
  return `***.${cleaned.slice(3, 6)}.***-**`;
}

/**
 * Masks an email: john.doe@gmail.com → j***@gmail.com
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || local.length === 0) return email;
  return `${local[0]}${"*".repeat(Math.min(local.length - 1, 5))}@${domain}`;
}

/**
 * Masks a phone: (11) 98765-4321 → (**) *****-4321
 */
export function maskPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 4) return phone;
  const lastFour = cleaned.slice(-4);
  if (cleaned.length === 11) {
    return `(**) *****-${lastFour}`;
  }
  if (cleaned.length === 10) {
    return `(**) ****-${lastFour}`;
  }
  return `${"*".repeat(cleaned.length - 4)}${lastFour}`;
}
