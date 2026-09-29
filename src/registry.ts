import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { rcompare } from 'semver';

export const MAX_PACKAGE_BYTES = 2_000_000;
export const manifestSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
  name: z.string().min(1).max(80),
  subtitle: z.string().max(80),
  description: z.string().max(400),
  category: z.enum(['数据处理', '编码转换', '开发辅助', '文本工具']),
  version: z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
  color: z.enum(['amber', 'blue', 'cyan', 'rose', 'teal', 'violet', 'orange', 'green']),
  tags: z.array(z.string().max(40)).max(10),
  permissions: z.array(z.never()).length(0),
}).strict();
export const releaseSchema = z.object({
  manifest: manifestSchema,
  apiVersion: z.literal(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive().max(MAX_PACKAGE_BYTES),
}).strict();
export const catalogSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  releases: z.array(releaseSchema).max(2000),
}).strict();
export const envelopeSchema = z.object({
  payload: z.string().max(2_000_000),
  signature: z.string().regex(/^[a-f0-9]{128}$/),
}).strict();
export type Manifest = z.infer<typeof manifestSchema>;
export type Release = z.infer<typeof releaseSchema>;
export type Envelope = z.infer<typeof envelopeSchema>;
export const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');

export function publicKey(rawHex: string) {
  if (!/^[a-f0-9]{64}$/.test(rawHex)) throw new Error('Invalid Ed25519 public key');
  return createPublicKey({ key: Buffer.from(`302a300506032b6570032100${rawHex}`, 'hex'), format: 'der', type: 'spki' });
}
export function verifyCatalog(value: unknown, key: string) {
  const envelope = envelopeSchema.parse(value);
  if (!verify(null, Buffer.from(envelope.payload), publicKey(key), Buffer.from(envelope.signature, 'hex'))) {
    throw new Error('Invalid catalog signature');
  }
  const catalog = catalogSchema.parse(JSON.parse(envelope.payload));
  const identities = catalog.releases.map((release) => `${release.manifest.id}@${release.manifest.version}`);
  if (new Set(identities).size !== identities.length) throw new Error('Duplicate tool release');
  return { envelope, catalog };
}

export async function loadRegistry(directory: string) {
  const trust = JSON.parse(await readFile(join(directory, 'trust.json'), 'utf8')) as { publicKey: string };
  const { envelope, catalog } = verifyCatalog(JSON.parse(await readFile(join(directory, 'catalog.json'), 'utf8')), trust.publicKey);
  const packages = new Map<string, Buffer>();
  for (const release of catalog.releases) {
    if (packages.has(release.sha256)) continue;
    const html = await readFile(join(directory, 'packages', `${release.sha256}.html`));
    if (html.byteLength !== release.bytes || digest(html) !== release.sha256) throw new Error(`Corrupted package ${release.manifest.id}`);
    packages.set(release.sha256, html);
  }
  const latest = new Map<string, Release>();
  for (const release of [...catalog.releases].sort((a, b) => rcompare(a.manifest.version, b.manifest.version))) {
    if (!latest.has(release.manifest.id)) latest.set(release.manifest.id, release);
  }
  return { envelope, catalog, packages, latest, etag: `"${digest(JSON.stringify(envelope))}"` };
}
export type Registry = Awaited<ReturnType<typeof loadRegistry>>;
