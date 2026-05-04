import type { Language } from './graph.js';

export interface ScanRequest {
  rootPath: string;
  languages?: Language[];
  ignore?: string[];
  respectGitignore?: boolean;
  force?: boolean;
}

export interface ScanResponse {
  projectId: string;
  rootPath: string;
  filesQueued: number;
}
