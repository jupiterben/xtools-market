import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { manifestSchema } from '../src/registry.js';
import { buildTool } from '../scripts/build-tool.js';

test('each catalog tool has its own directory and local entry point', async () => {
  const manifests = manifestSchema.array().parse(JSON.parse(await readFile('tools/catalog.json', 'utf8')));
  const directories = (await readdir('tools', { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name !== 'shared')
    .map((entry) => entry.name);
  assert.deepEqual(directories.sort(), manifests.map((manifest) => manifest.id).sort());
  for (const { id } of manifests) {
    const html = await readFile(`tools/${id}/index.html`, 'utf8');
    assert.match(html, /src="\.\/main\.ts"/);
    assert.ok((await readFile(`tools/${id}/main.ts`, 'utf8')).trim());
  }
});

test('tool builds reject IDs that could escape the tool directory', async () => {
  for (const id of ['../json', '..\\json', '/json', 'C:\\json', '']) {
    await assert.rejects(buildTool(id));
  }
});
