import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB } from '../db/database.js';
import { Repository } from '../db/repository.js';
import { createProvider } from '../ai/factory.js';

const ProviderConfigSchema = z.object({
  name: z.enum(['ollama', 'deepseek', 'openai', 'anthropic', 'openrouter']),
  model: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
});

const DescribeBody = z.object({ provider: ProviderConfigSchema });
const ReviewBody = z.object({ provider: ProviderConfigSchema });

export async function registerAIRoutes(app: FastifyInstance, deps: { db: DB }): Promise<void> {
  const repo = new Repository(deps.db);

  app.post<{ Params: { nodeId: string }; Querystring: { force?: string } }>(
    '/ai/describe/:nodeId',
    async (request, reply) => {
      const parsed = DescribeBody.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

      const node = repo.getNode(request.params.nodeId);
      if (!node) return reply.status(404).send({ error: 'node not found' });

      const force = request.query.force === 'true' || request.query.force === '1';
      if (!force) {
        const cached = repo.getNodeDescription(node.id);
        if (cached) return { ...cached, cached: true };
      }

      let snippet = '';
      try {
        const src = await readFile(node.fileAbsPath, 'utf8');
        const lines = src.split('\n');
        snippet = lines
          .slice(Math.max(0, node.location.startLine - 1), node.location.endLine)
          .join('\n')
          .slice(0, 6000);
      } catch {
        // ignore
      }

      try {
        const provider = createProvider(parsed.data.provider);
        const description = await provider.describeNode(node, snippet);
        repo.saveNodeDescription(description);
        return { ...description, cached: false };
      } catch (err) {
        request.log.error(err);
        return reply.status(502).send({ error: err instanceof Error ? err.message : 'provider error' });
      }
    },
  );

  app.get<{ Params: { nodeId: string } }>('/ai/describe/:nodeId', async (request, reply) => {
    const cached = repo.getNodeDescription(request.params.nodeId);
    if (!cached) return reply.status(404).send({ error: 'no cached description' });
    return { ...cached, cached: true };
  });

  app.post<{ Params: { projectId: string }; Querystring: { force?: string } }>(
    '/ai/review/:projectId',
    async (request, reply) => {
      const parsed = ReviewBody.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

      const force = request.query.force === 'true' || request.query.force === '1';
      if (!force) {
        const cached = repo.getLatestReview(request.params.projectId);
        if (cached) return { ...cached, cached: true };
      }

      let graph;
      try {
        graph = repo.loadGraph(request.params.projectId);
      } catch (err) {
        return reply.status(404).send({ error: err instanceof Error ? err.message : 'not found' });
      }

      try {
        const provider = createProvider(parsed.data.provider);
        const review = await provider.reviewArchitecture(graph);
        repo.saveReview(request.params.projectId, review);
        return { ...review, cached: false };
      } catch (err) {
        request.log.error(err);
        return reply.status(502).send({ error: err instanceof Error ? err.message : 'provider error' });
      }
    },
  );

  app.get<{ Params: { projectId: string } }>('/ai/review/:projectId', async (request, reply) => {
    const cached = repo.getLatestReview(request.params.projectId);
    if (!cached) return reply.status(404).send({ error: 'no cached review' });
    return { ...cached, cached: true };
  });
}
