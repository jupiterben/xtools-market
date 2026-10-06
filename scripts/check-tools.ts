import { readFile } from 'node:fs/promises';
import { digest, loadRegistry, manifestSchema } from '../src/registry.js';
import { buildTool } from './build-tool.js';

const registry = await loadRegistry('registry');
const manifests = manifestSchema.array().parse(JSON.parse(await readFile('tools/catalog.json', 'utf8')));
for (const manifest of manifests) {
  const release = registry.catalog.releases.find((entry) => entry.manifest.id === manifest.id && entry.manifest.version === manifest.version);
  if (!release || JSON.stringify(release.manifest) !== JSON.stringify(manifest)) throw new Error(`Missing signed release for ${manifest.id}`);
  if (digest(await buildTool(manifest.id)) !== release.sha256) {
    throw new Error(`Source differs from signed package: ${manifest.id}. Bump its version and run tools:release.`);
  }
}
console.log('All signed packages match their source builds.');
