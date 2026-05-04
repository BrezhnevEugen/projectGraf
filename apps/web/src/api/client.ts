import type {
  ArchitectureReview,
  Graph,
  GraphEdge,
  GraphNode,
  NodeDescription,
  ProgressEvent,
  ProviderConfig,
  ScanRequest,
  Smell,
} from '@projectgraf/shared';

const API = '/api';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface ProjectRecord {
  id: string;
  root_path: string;
  created_at: string;
  last_scanned_at: string | null;
}

export interface NodeDetail {
  node: GraphNode & { projectId: string; fileAbsPath: string };
  incoming: GraphEdge[];
  outgoing: GraphEdge[];
  snippet: string | null;
}

export const api = {
  health: () => http<{ status: string }>('/health'),
  listProjects: () => http<ProjectRecord[]>('/projects'),
  scan: (req: ScanRequest) =>
    http<{ projectId: string; rootPath: string; filesQueued: number }>('/scan', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  graph: (projectId: string) => http<Graph>(`/graph/${projectId}`),
  node: (nodeId: string) => http<NodeDetail>(`/node/${nodeId}`),
  smells: (projectId: string) => http<Smell[]>(`/smells/${projectId}`),
  describe: (nodeId: string, provider: ProviderConfig, force = false) =>
    http<NodeDescription & { cached?: boolean }>(
      `/ai/describe/${nodeId}${force ? '?force=1' : ''}`,
      { method: 'POST', body: JSON.stringify({ provider }) },
    ),
  cachedDescription: async (nodeId: string) => {
    const res = await fetch(`${API}/ai/describe/${nodeId}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as NodeDescription & { cached: true };
  },
  review: (projectId: string, provider: ProviderConfig, force = false) =>
    http<ArchitectureReview & { cached?: boolean }>(
      `/ai/review/${projectId}${force ? '?force=1' : ''}`,
      { method: 'POST', body: JSON.stringify({ provider }) },
    ),
};

export function openProgressSocket(
  projectId: string,
  onEvent: (event: ProgressEvent) => void,
): WebSocket {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws/progress?projectId=${projectId}`);
  ws.addEventListener('message', (e) => {
    try {
      onEvent(JSON.parse(e.data) as ProgressEvent);
    } catch {
      // ignore
    }
  });
  return ws;
}
