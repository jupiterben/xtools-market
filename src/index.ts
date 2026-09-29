import { createApp } from './app.js';

const app = await createApp({
  registryDir: process.env.REGISTRY_DIR ?? 'registry',
  origins: process.env.CORS_ORIGINS?.split(',').map((value) => value.trim()).filter(Boolean),
  logger: true,
});
const port = Number(process.env.PORT ?? 1430);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
await app.listen({ host: process.env.HOST ?? '127.0.0.1', port });
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => { void app.close(); });
}
