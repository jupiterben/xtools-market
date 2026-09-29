import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadRegistry } from './registry.js';

export async function buildSite(registryDir = 'registry', outputDir = '_site') {
  const source = resolve(registryDir);
  const output = resolve(outputDir);
  // Publication has one dedicated output directory; never clean a source or arbitrary parent.
  if (output !== resolve('_site') || source === output || source.startsWith(`${output}/`)) {
    throw new Error('Static publication must use the dedicated _site directory');
  }
  const registry = await loadRegistry(source);
  const staging = join(dirname(output), `.build/site-${randomUUID()}`);
  try {
    await mkdir(join(staging, 'packages'), { recursive: true });
    await writeFile(join(staging, 'catalog.json'), await readFile(join(source, 'catalog.json')));
    for (const [sha, bytes] of registry.packages) {
      // A data extension prevents a normal browser visit from executing tools in the Pages origin.
      await writeFile(join(staging, 'packages', `${sha}.xtool`), bytes);
    }
    await writeFile(join(staging, '.nojekyll'), '');
    await writeFile(join(staging, 'health.json'), `${JSON.stringify({
      status: 'ok', schemaVersion: 1, tools: registry.latest.size, packages: registry.packages.size,
    })}\n`);
    await rm(output, { recursive: true, force: true });
    await rename(staging, output);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return registry;
}
