/** Conservative shape rule, not an identity lookup or a TCKN checksum test.
 * NFKC folds full-width digits; separators may not disguise an 11-digit code.
 * Only an entire numeric code is blocked: ordinary prefixed business codes stay valid.
 */
export function blockedPersonCode(value: unknown): boolean {
  return typeof value === 'string' && /^[0-9]{11}$/.test(value.normalize('NFKC').replace(/[\s.()\-]/g, ''));
}
export const PERSON_CODE_MESSAGE = 'Personel kodu 11 rakamdan oluşamaz. TC kimlik numarası yerine ayrı bir personel kodu kullanın.';
export function requireSafePersonCode(value: unknown): void {
  if (blockedPersonCode(value)) throw new Error('REPORT_PERSON_CODE_PRIVATE');
}
