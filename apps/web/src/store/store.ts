import { create } from 'zustand';
import type {
  ArchitectureReview,
  Graph,
  ProgressEvent,
  ProviderConfig,
  Smell,
} from '@projectgraf/shared';
import { api, openProgressSocket, type NodeDetail, type ProjectRecord } from '../api/client.js';

const PROVIDER_KEY = 'projectgraf.provider';

function loadProvider(): ProviderConfig {
  try {
    const raw = localStorage.getItem(PROVIDER_KEY);
    if (raw) return JSON.parse(raw) as ProviderConfig;
  } catch {
    // fall through
  }
  return { name: 'ollama', model: 'llama3.1' };
}

function saveProvider(p: ProviderConfig): void {
  try {
    localStorage.setItem(PROVIDER_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

export interface ScanProgress {
  active: boolean;
  current: number;
  total: number;
  lastFile?: string;
  durationMs?: number;
  error?: string;
}

export interface AppState {
  projects: ProjectRecord[];
  currentProjectId: string | null;
  graph: Graph | null;
  smells: Smell[];
  selectedNodeId: string | null;
  selectedNodeDetail: NodeDetail | null;
  scanProgress: ScanProgress;
  provider: ProviderConfig;
  description: import('@projectgraf/shared').NodeDescription | null;
  review: ArchitectureReview | null;
  reviewLoading: boolean;
  describeLoading: boolean;

  refreshProjects(): Promise<void>;
  startScan(req: { rootPath: string; force?: boolean }): Promise<void>;
  loadGraph(projectId: string): Promise<void>;
  loadSmells(): Promise<void>;
  selectNode(nodeId: string | null): Promise<void>;
  setProvider(p: ProviderConfig): void;
  describeSelected(force?: boolean): Promise<void>;
  runReview(force?: boolean): Promise<void>;
  handleProgress(event: ProgressEvent): void;
}

export const useAppStore = create<AppState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  graph: null,
  smells: [],
  selectedNodeId: null,
  selectedNodeDetail: null,
  scanProgress: { active: false, current: 0, total: 0 },
  provider: loadProvider(),
  description: null,
  review: null,
  reviewLoading: false,
  describeLoading: false,

  async refreshProjects() {
    const projects = await api.listProjects();
    set({ projects });
  },

  async startScan(req) {
    set({
      scanProgress: { active: true, current: 0, total: 0, error: undefined },
      description: null,
      review: null,
    });

    const optimistic = await api.scan({ rootPath: req.rootPath, force: req.force });
    const ws = openProgressSocket(optimistic.projectId, (e) => get().handleProgress(e));
    await get().loadGraph(optimistic.projectId);
    await get().loadSmells();
    await get().refreshProjects();
    ws.close();
  },

  async loadGraph(projectId) {
    const graph = await api.graph(projectId);
    set({ graph, currentProjectId: projectId, selectedNodeId: null, selectedNodeDetail: null });
  },

  async loadSmells() {
    const id = get().currentProjectId;
    if (!id) return;
    const smells = await api.smells(id);
    set({ smells });
  },

  async selectNode(nodeId) {
    if (!nodeId) {
      set({ selectedNodeId: null, selectedNodeDetail: null, description: null });
      return;
    }
    set({ selectedNodeId: nodeId, description: null });
    const [detail, cached] = await Promise.all([api.node(nodeId), api.cachedDescription(nodeId)]);
    set({ selectedNodeDetail: detail, description: cached ?? null });
  },

  setProvider(p) {
    saveProvider(p);
    set({ provider: p });
  },

  async describeSelected(force = false) {
    const { selectedNodeId, provider } = get();
    if (!selectedNodeId) return;
    set({ describeLoading: true });
    try {
      const description = await api.describe(selectedNodeId, provider, force);
      set({ description });
    } finally {
      set({ describeLoading: false });
    }
  },

  async runReview(force = false) {
    const { currentProjectId, provider } = get();
    if (!currentProjectId) return;
    set({ reviewLoading: true });
    try {
      const review = await api.review(currentProjectId, provider, force);
      set({ review });
    } finally {
      set({ reviewLoading: false });
    }
  },

  handleProgress(event) {
    const sp = get().scanProgress;
    if (event.type === 'scan:start') {
      set({ scanProgress: { active: true, current: 0, total: event.total } });
    } else if (event.type === 'scan:file') {
      set({
        scanProgress: { active: true, current: event.index, total: event.total, lastFile: event.file },
      });
    } else if (event.type === 'scan:done') {
      set({ scanProgress: { ...sp, active: false, durationMs: event.durationMs } });
    } else if (event.type === 'scan:error') {
      set({ scanProgress: { ...sp, error: event.error } });
    }
  },
}));
