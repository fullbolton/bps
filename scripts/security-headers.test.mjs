import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

test('all routes prohibit framing and set browser safety headers without breaking scripts', async () => {
  const source=readFileSync(new URL('../next.config.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
  const {default:config}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const rules=await config.headers();
  assert.equal(rules.length,1);
  assert.equal(rules[0].source,'/:path*');
  const headers=Object.fromEntries(rules[0].headers.map(({key,value})=>[key.toLowerCase(),value]));
  assert.equal(headers['content-security-policy'],"frame-ancestors 'none'");
  assert.equal(headers['x-frame-options'],'DENY');
  assert.equal(headers['x-content-type-options'],'nosniff');
  assert.equal(headers['referrer-policy'],'strict-origin-when-cross-origin');
  assert.equal(config.experimental.middlewareClientMaxBodySize,'11mb');
});
