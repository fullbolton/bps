export const PRIVATE_TEXT_CODE = 'OPERATION_TEXT_PRIVATE';
export const PRIVATE_TEXT_MESSAGE = 'Notta kimlik numarası veya telefon numarası olabilecek bir sayı var. Bu bilgiyi çıkarıp yalnız operasyon bilgisini yazın.';
/** Shape screening only. Maximal number runs avoid matching substrings of longer numeric codes.
 * No checksum, identity lookup or general sensitive-content detection is claimed.
 */
export function hasPrivateOperationalText(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const text = value.normalize('NFKC');
  for (const match of text.matchAll(/[0-9][0-9 .()\-]*[0-9]|[0-9]/g)) {
    const digits = match[0].replace(/[^0-9]/g, '');
    if (digits.length === 11 || /^5[0-9]{9}$/.test(digits) || /^905[0-9]{9}$/.test(digits)) return true;
  }
  return false;
}
export function requireOperationalText(value: unknown): void {
  if (hasPrivateOperationalText(value)) throw new Error(PRIVATE_TEXT_CODE);
}
export function privateTextError(error: unknown): string | null {
  return error && typeof error === 'object' && 'message' in error && String(error.message).includes(PRIVATE_TEXT_CODE) ? PRIVATE_TEXT_MESSAGE : null;
}
