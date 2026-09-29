import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { loadRegistry, type Registry } from './registry.js';

const querySchema = z.object({
  q: z.string().max(100).default(''),
  category: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export async function createApp(options: { registryDir?: string; registry?: Registry; origins?: string[]; logger?: boolean } = {}) {
  const registry = options.registry ?? await loadRegistry(options.registryDir ?? 'registry');
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 1024, trustProxy: false });
  await app.register(helmet);
  await app.register(cors, {
    origin: options.origins ?? ['http://127.0.0.1:1420', 'http://localhost:1420'],
    methods: ['GET', 'HEAD'],
    credentials: false,
    exposedHeaders: ['ETag'],
  });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: 'Invalid request', details: error.issues });
    request.log.error(error);
    const code = (error as { statusCode?: number }).statusCode;
    const status = typeof code === 'number' && code < 500 ? code : 500;
    return reply.code(status).send({ error: status < 500 ? 'Request rejected' : 'Internal server error' });
  });
  app.get('/healthz', async () => ({ status: 'ok', tools: registry.latest.size }));
  app.get('/v1/catalog', async (request, reply) => {
    reply.header('Cache-Control', 'public, max-age=60').header('ETag', registry.etag);
    if (request.headers['if-none-match'] === registry.etag) return reply.code(304).send();
    return registry.envelope;
  });
  app.get('/v1/tools', async (request) => {
    const query = querySchema.parse(request.query);
    const term = query.q.toLocaleLowerCase();
    const items = [...registry.latest.values()].filter(({ manifest }) =>
      (!query.category || manifest.category === query.category)
      && `${manifest.name} ${manifest.subtitle} ${manifest.tags.join(' ')}`.toLocaleLowerCase().includes(term));
    return { total: items.length, page: query.page, pageSize: query.pageSize, items: items.slice((query.page - 1) * query.pageSize, query.page * query.pageSize) };
  });
  app.get<{ Params: { id: string } }>('/v1/tools/:id', async (request, reply) => {
    const release = registry.latest.get(request.params.id);
    return release ?? reply.code(404).send({ error: 'Tool not found' });
  });
  app.get<{ Params: { id: string } }>('/v1/tools/:id/versions', async (request, reply) => {
    const versions = registry.catalog.releases.filter((release) => release.manifest.id === request.params.id);
    return versions.length ? { items: versions } : reply.code(404).send({ error: 'Tool not found' });
  });
  app.get<{ Params: { sha: string } }>('/v1/packages/:sha', async (request, reply) => {
    const sha = request.params.sha;
    if (!/^[a-f0-9]{64}$/.test(sha)) return reply.code(400).send({ error: 'Invalid package digest' });
    const bytes = registry.packages.get(sha);
    if (!bytes) return reply.code(404).send({ error: 'Package not found' });
    // Tool HTML is downloadable data, never a page served in the market origin.
    return reply.type('application/octet-stream')
      .header('Content-Disposition', `attachment; filename="${sha}.html"`)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .header('ETag', `"${sha}"`)
      .send(bytes);
  });
  return app;
}
