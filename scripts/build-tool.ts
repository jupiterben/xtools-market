import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { manifestSchema } from '../src/registry.js';

export async function buildTool(id: string): Promise<Buffer> {
  manifestSchema.shape.id.parse(id);
  const outDir = resolve('.build', id);
  await build({
    configFile: false,
    root: resolve('tools', id),
    define: { __TOOL_ID__: JSON.stringify(id) },
    plugins: [viteSingleFile()],
    build: { outDir, emptyOutDir: true, target: 'es2022', cssCodeSplit: false },
  });
  return readFile(resolve(outDir, 'index.html'));
}
