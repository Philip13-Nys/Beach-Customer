export function validPaymentReference(value: string): boolean {
  return /^\d{10,20}$/.test(value.trim());
}
