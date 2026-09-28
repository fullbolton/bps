import test from 'node:test';
import assert from 'node:assert/strict';
import { importActualTypeScript } from './helpers/import-typescript.mjs';
const { formatTry, cityLabel } = await importActualTypeScript(new URL('../src/lib/display-values.ts', import.meta.url));
test('money preserves zero, negative values, and missing versus malformed input', () => {
  assert.match(formatTry('10000.00'), /10\.000,00/);
  assert.match(formatTry(0), /0,00/);
  assert.match(formatTry('-12.50'), /-.*12,50/);
  for (const value of [null, undefined, '', ' ', 'garbage', '10.000,00', Infinity, NaN]) assert.equal(formatTry(value), '—');
});
test('Istanbul variants share a display/filter key without changing other city names', () => {
  for (const value of ['Istanbul', 'İstanbul', 'ISTANBUL', 'istanbul', ' İstanbul ']) assert.equal(cityLabel(value), 'İstanbul');
  assert.equal(cityLabel('Ankara'), 'Ankara');
  assert.equal(cityLabel(null), '');
});
