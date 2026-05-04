import type { FastifyInstance } from 'fastify';
import type { ProgressEvent } from '@projectgraf/shared';
import { ProgressBus } from '../progress/bus.js';

export async function registerProgressRoutes(
  app: FastifyInstance,
  deps: { progress: ProgressBus },
): Promise<void> {
  app.get<{ Querystring: { projectId?: string } }>(
    '/ws/progress',
    { websocket: true },
    (socket, request) => {
      const projectId = request.query.projectId;
      const handler = (event: ProgressEvent) => {
        if (projectId && event.projectId !== projectId) return;
        socket.send(JSON.stringify(event));
      };
      deps.progress.on('event', handler);
      socket.on('close', () => deps.progress.off('event', handler));
    },
  );
}
