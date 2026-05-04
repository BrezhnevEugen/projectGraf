export type ProgressEvent =
  | { type: 'scan:start'; projectId: string; total: number }
  | { type: 'scan:file'; projectId: string; file: string; index: number; total: number }
  | { type: 'scan:done'; projectId: string; durationMs: number }
  | { type: 'scan:error'; projectId: string; file?: string; error: string }
  | { type: 'enrich:start'; projectId: string; total: number }
  | { type: 'enrich:node'; projectId: string; nodeId: string; index: number; total: number }
  | { type: 'enrich:done'; projectId: string };
