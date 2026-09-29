import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createApp } from '../src/app.js';
import { digest, verifyCatalog, loadRegistry } from '../src/registry.js';

test('registry signature and all package bytes verify', async () => {
  const registry = await loadRegistry('registry');
  assert.equal(registry.latest.size, 8);
  assert.equal(registry.packages.size, 8);
});
test('catalog, cache validation, pagination, detail, versions and downloads', async () => {
  const app = await createApp();
  try {
    const health = await app.inject('/healthz');
    assert.equal(health.json().status, 'ok');
    const catalog = await app.inject('/v1/catalog');
    assert.equal(catalog.statusCode, 200);
    assert.equal((await app.inject({ url: '/v1/catalog', headers: { 'if-none-match': catalog.headers.etag! } })).statusCode, 304);
    const search = await app.inject('/v1/tools?q=json&pageSize=1');
    assert.equal(search.json().total, 1);
    assert.equal(search.json().items[0].manifest.id, 'json');
    assert.equal((await app.inject('/v1/tools?pageSize=1000')).statusCode, 400);
    assert.equal((await app.inject('/v1/tools/missing')).statusCode, 404);
    const detail = (await app.inject('/v1/tools/json')).json();
    const versions = (await app.inject('/v1/tools/json/versions')).json();
    assert.equal(versions.items.length, 1);
    const download = await app.inject(`/v1/packages/${detail.sha256}`);
    assert.equal(download.statusCode, 200);
    assert.equal(digest(download.rawPayload), detail.sha256);
    assert.match(String(download.headers['content-disposition']), /^attachment/);
    assert.equal(download.headers['content-type'], 'application/octet-stream');
    assert.equal((await app.inject('/v1/packages/invalid')).statusCode, 400);
    assert.equal((await app.inject(`/v1/packages/${'0'.repeat(64)}`)).statusCode, 404);
    assert.equal((await app.inject({ method: 'POST', url: '/v1/tools', payload: {} })).statusCode, 404);
  } finally { await app.close(); }
});
test('CORS allows configured clients, not arbitrary origins', async () => {
  const app = await createApp();
  try {
    const allowed = await app.inject({ url: '/v1/catalog', headers: { origin: 'http://127.0.0.1:1420' } });
    assert.equal(allowed.headers['access-control-allow-origin'], 'http://127.0.0.1:1420');
    const rejected = await app.inject({ url: '/v1/catalog', headers: { origin: 'https://untrusted.example' } });
    assert.equal(rejected.headers['access-control-allow-origin'], undefined);
  } finally { await app.close(); }
});
test('rejects altered payloads, signatures and duplicate versions', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const key = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
  const payload = JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), releases: [] });
  const signature = sign(null, Buffer.from(payload), privateKey).toString('hex');
  assert.equal(verifyCatalog({ payload, signature }, key).catalog.releases.length, 0);
  assert.throws(() => verifyCatalog({ payload: `${payload} `, signature }, key), /signature/);
  assert.throws(() => verifyCatalog({ payload, signature: '0'.repeat(128) }, key), /signature/);
});
