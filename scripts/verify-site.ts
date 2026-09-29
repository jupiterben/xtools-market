import { readFile } from 'node:fs/promises';
import { digest, verifyCatalog } from '../src/registry.js';

const configured = process.env.MARKET_URL ?? process.argv[2];
if (!configured) throw new Error('Set MARKET_URL or pass a static market base URL');
const base = new URL(configured.endsWith('/') ? configured : `${configured}/`);
if (!['https:', 'http:'].includes(base.protocol)) throw new Error('Invalid market URL');
const trust = JSON.parse(await readFile('registry/trust.json', 'utf8')) as { publicKey: string };
const local = verifyCatalog(JSON.parse(await readFile('registry/catalog.json', 'utf8')), trust.publicKey);

async function verifyDeployment() {
  const response = await fetch(new URL('catalog.json', base), { signal: AbortSignal.timeout(15000), cache: 'no-cache', redirect: 'error' });
  if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
  if (base.protocol === 'https:' && response.headers.get('access-control-allow-origin') !== '*') {
    throw new Error('Public static catalog must support browser CORS');
  }
  const { envelope, catalog } = verifyCatalog(await response.json(), trust.publicKey);
  if (envelope.payload !== local.envelope.payload || envelope.signature !== local.envelope.signature) {
    throw new Error('Deployment still serves a different catalog');
  }
  for (const release of catalog.releases) {
    const pkg = await fetch(new URL(`packages/${release.sha256}.xtool`, base), { signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!pkg.ok) throw new Error(`Package HTTP ${pkg.status}`);
    if (pkg.headers.get('content-type')?.includes('text/html')) throw new Error('Tool must be served as data, not HTML');
    const bytes = new Uint8Array(await pkg.arrayBuffer());
    if (bytes.length !== release.bytes || digest(bytes) !== release.sha256) throw new Error('Deployed package checksum mismatch');
  }
  console.log(`Verified live static market: ${base.href} (${catalog.releases.length} releases).`);
}

const attempts = Number(process.env.VERIFY_ATTEMPTS ?? 1);
if (!Number.isInteger(attempts) || attempts < 1 || attempts > 12) throw new Error('Invalid VERIFY_ATTEMPTS');
for (let attempt = 1; attempt <= attempts; attempt++) {
  try { await verifyDeployment(); break; }
  catch (error) {
    if (attempt === attempts) throw error;
    console.log(`Deployment propagation check ${attempt}/${attempts}: ${String(error)}`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}
