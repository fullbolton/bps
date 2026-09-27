export type LocalReference<T> = { kind: 'empty' } | { kind: 'valid'; value: T } | { kind: 'invalid' } | { kind: 'unavailable' };

/** Read without deleting an uncertain command or exposing its raw contents. */
export function readLocalReference<T>(read: () => string | null, parse: (input: unknown) => T): LocalReference<T> {
  let raw: string | null;
  try { raw = read(); } catch { return { kind: 'unavailable' }; }
  if (raw === null) return { kind: 'empty' };
  try { return { kind: 'valid', value: parse(JSON.parse(raw)) }; }
  catch { return { kind: 'invalid' }; }
}

/** Call only after the server has resolved the command. Keep UI state if removal fails. */
export function clearResolvedLocalReference(remove: () => void): boolean {
  try { remove(); return true; } catch { return false; }
}
