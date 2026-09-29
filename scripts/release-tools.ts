import { createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'node:path';
import { catalogSchema, digest, manifestSchema, verifyCatalog } from '../src/registry.js';

const manifests = manifestSchema.array().parse(JSON.parse(await readFile('tools/catalog.json', 'utf8')));
const key = createPrivateKey(await readFile(process.env.SIGNING_KEY_FILE ?? '.keys/market.pem'));
const trust = JSON.parse(await readFile('registry/trust.json', 'utf8')) as { publicKey: string };
if (createPublicKey(key).export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex') !== trust.publicKey) throw new Error('Signing key does not match trust.json');
let previous: ReturnType<typeof catalogSchema.parse>['releases'] = [];
try {
  await access('registry/catalog.json');
  previous = verifyCatalog(JSON.parse(await readFile('registry/catalog.json', 'utf8')), trust.publicKey).catalog.releases;
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const releases = [...previous];
await mkdir('registry/packages', { recursive: true });
for (const manifest of manifests) {
  await build({
    configFile: false,
    root: resolve('tools'),
    define: { __TOOL_ID__: JSON.stringify(manifest.id) },
    plugins: [viteSingleFile()],
    build: { outDir: resolve('.build', manifest.id), emptyOutDir: true, target: 'es2022', cssCodeSplit: false },
  });
  const bytes = await readFile(`.build/${manifest.id}/index.html`);
  const sha256 = digest(bytes);
  const existing = previous.find((release) => release.manifest.id === manifest.id && release.manifest.version === manifest.version);
  if (existing) {
    if (existing.sha256 !== sha256 || JSON.stringify(existing.manifest) !== JSON.stringify(manifest)) throw new Error(`${manifest.id}@${manifest.version} is immutable; bump its version`);
    continue;
  }
  await writeFile(`registry/packages/${sha256}.html`, bytes);
  releases.push({ manifest, apiVersion: 1, sha256, bytes: bytes.byteLength });
}
const payload = JSON.stringify(catalogSchema.parse({ schemaVersion: 1, generatedAt: new Date().toISOString(), releases }));
await writeFile('registry/catalog.json', `${JSON.stringify({ payload, signature: sign(null, Buffer.from(payload), key).toString('hex') }, null, 2)}\n`);
console.log(`Signed ${releases.length} immutable releases.`);
