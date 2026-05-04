import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { DB } from '../db/database.js';
import { Repository } from '../db/repository.js';
import { detectSmells } from '../analysis/smells.js';

export async function registerGraphRoutes(app: FastifyInstance, deps: { db: DB }): Promise<void> {
  const repo = new Repository(deps.db);

  app.get('/projects', async () => repo.listProjects());

  app.get<{ Params: { projectId: string } }>('/graph/:projectId', async (request, reply) => {
    try {
      return repo.loadGraph(request.params.projectId);
    } catch (err) {
      return reply.status(404).send({ error: err instanceof Error ? err.message : 'not found' });
    }
  });

  app.get<{ Params: { nodeId: string } }>('/node/:nodeId', async (request, reply) => {
    const node = repo.getNode(request.params.nodeId);
    if (!node) return reply.status(404).send({ error: 'node not found' });

    const graph = repo.loadGraph(node.projectId);
    const incoming = graph.edges.filter((e) => e.targetId === node.id);
    const outgoing = graph.edges.filter((e) => e.sourceId === node.id);
    let snippet: string | null = null;
    try {
      const src = await readFile(node.fileAbsPath, 'utf8');
      const lines = src.split('\n');
      snippet = lines
        .slice(Math.max(0, node.location.startLine - 1), node.location.endLine)
        .join('\n');
    } catch {
      // file missing
    }
    return { node, incoming, outgoing, snippet };
  });

  app.get<{ Params: { projectId: string } }>('/smells/:projectId', async (request, reply) => {
    try {
      const graph = repo.loadGraph(request.params.projectId);
      return detectSmells(graph);
    } catch (err) {
      return reply.status(404).send({ error: err instanceof Error ? err.message : 'not found' });
    }
  });
}
