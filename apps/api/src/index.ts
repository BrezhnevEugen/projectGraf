import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { loadConfig } from './config.js';
import { openDatabase } from './db/database.js';
import { registerScanRoutes } from './routes/scan.js';
import { registerGraphRoutes } from './routes/graph.js';
import { registerAIRoutes } from './routes/ai.js';
import { registerProgressRoutes } from './routes/progress.js';
import { ProgressBus } from './progress/bus.js';

async function main() {
  const config = loadConfig();
  mkdirSync(dirname(config.dbPath), { recursive: true });

  const db = openDatabase(config.dbPath);
  const progress = new ProgressBus();

  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  app.get('/health', async () => ({ status: 'ok', dbPath: config.dbPath }));

  await registerScanRoutes(app, { db, progress });
  await registerGraphRoutes(app, { db });
  await registerAIRoutes(app, { db });
  await registerProgressRoutes(app, { progress });

  await app.listen({ port: config.port, host: config.host });
  app.log.info(`projectgraf api ready on http://${config.host}:${config.port}`);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
