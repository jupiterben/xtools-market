import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { digest, loadRegistry, manifestSchema } from '../src/registry.js';

const registry = await loadRegistry('registry');
const manifests = manifestSchema.array().parse(JSON.parse(await readFile('tools/catalog.json', 'utf8')));
for (const manifest of manifests) {
  const release = registry.catalog.releases.find((entry) => entry.manifest.id === manifest.id && entry.manifest.version === manifest.version);
  if (!release || JSON.stringify(release.manifest) !== JSON.stringify(manifest)) throw new Error(`Missing signed release for ${manifest.id}`);
  await build({
    configFile: false, root: resolve('tools'),
    define: { __TOOL_ID__: JSON.stringify(manifest.id) },
    plugins: [viteSingleFile()],
    build: { outDir: resolve('.build', manifest.id), emptyOutDir: true, target: 'es2022', cssCodeSplit: false },
  });
  if (digest(await readFile(`.build/${manifest.id}/index.html`)) !== release.sha256) {
    throw new Error(`Source differs from signed package: ${manifest.id}. Bump its version and run tools:release.`);
  }
}
console.log('All signed packages match their source builds.');
