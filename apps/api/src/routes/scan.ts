import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB } from '../db/database.js';
import { ProgressBus } from '../progress/bus.js';
import { ScanService } from '../services/scan-service.js';

const ScanBody = z.object({
  rootPath: z.string().min(1),
  languages: z.array(z.enum(['php', 'javascript', 'html'])).optional(),
  ignore: z.array(z.string()).optional(),
  respectGitignore: z.boolean().optional(),
  force: z.boolean().optional(),
});

export async function registerScanRoutes(
  app: FastifyInstance,
  deps: { db: DB; progress: ProgressBus },
): Promise<void> {
  const service = new ScanService(deps);

  app.post('/scan', async (request, reply) => {
    const parsed = ScanBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    try {
      const result = await service.scan(parsed.data);
      return { ...result, rootPath: parsed.data.rootPath };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'scan failed' });
    }
  });
}
