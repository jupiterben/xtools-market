import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { digest, loadRegistry, verifyCatalog } from '../src/registry.js';
import { buildSite } from '../src/site.js';
import { escapeHtml, renderHomepage } from '../src/homepage.js';

test('registry signature and all package bytes verify', async () => {
  const registry = await loadRegistry('registry');
  assert.equal(registry.latest.size, 8);
  assert.equal(registry.packages.size, 8);
});

test('rejects altered payloads, signatures and duplicate release identities', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const key = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
  const catalog = (await loadRegistry('registry')).catalog;
  const signed = (value: unknown) => {
    const payload = JSON.stringify(value);
    return { payload, signature: sign(null, Buffer.from(payload), privateKey).toString('hex') };
  };
  const envelope = signed(catalog);
  assert.equal(verifyCatalog(envelope, key).catalog.releases.length, 8);
  assert.throws(() => verifyCatalog({ ...envelope, payload: `${envelope.payload} ` }, key), /signature/);
  assert.throws(() => verifyCatalog({ ...envelope, signature: '0'.repeat(128) }, key), /signature/);
  assert.throws(() => verifyCatalog(signed({ ...catalog, releases: [catalog.releases[0], catalog.releases[0]] }), key), /Duplicate/);
});

test('static site is an allowlisted byte-exact export, without stale or private files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'xtools-static-'));
  try {
    const registry = await buildSite();
    await writeFile('_site/stale-private-file.pem', 'test-only fixture');
    await buildSite();
    assert.deepEqual((await readdir('_site')).sort(), ['.nojekyll', 'catalog.json', 'favicon.png', 'health.json', 'index.html', 'market.css', 'market.js', 'packages']);
    assert.deepEqual(await readFile('_site/catalog.json'), await readFile('registry/catalog.json'));
    const files = await readdir('_site/packages');
    assert.equal(files.length, registry.packages.size);
    for (const [sha, original] of registry.packages) {
      const bytes = await readFile(`_site/packages/${sha}.xtool`);
      assert.deepEqual(bytes, original);
      assert.equal(digest(bytes), sha);
    }
    await assert.rejects(buildSite('registry', directory), /dedicated/);
    const before = await readFile('_site/catalog.json');
    await assert.rejects(buildSite(directory));
    assert.deepEqual(await readFile('_site/catalog.json'), before);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('homepage renders verified tools and client install links without script injection', async () => {
  const registry = await loadRegistry('registry');
  const html = await renderHomepage(registry);
  assert.match(html, /data-market-home/);
  assert.equal((html.match(/class="tool-card"/g) ?? []).length, registry.latest.size);
  for (const release of registry.latest.values()) {
    assert.ok(html.includes(`href="xtools://install?id=${encodeURIComponent(release.manifest.id)}"`));
  }
  assert.ok(!html.includes(' download='));
  assert.ok(!html.includes('href="./packages/'));
  assert.equal(escapeHtml('<script>"x"&\'</script>'), '&lt;script&gt;&quot;x&quot;&amp;&#39;&lt;/script&gt;');
  const first = registry.latest.values().next().value!;
  const malicious = { ...first, manifest: { ...first.manifest, name: '"><script>alert(1)</script>' } };
  const safe = await renderHomepage({ ...registry, latest: new Map([[first.manifest.id, malicious]]) });
  assert.ok(!safe.includes('<script>alert(1)</script>'));
});
