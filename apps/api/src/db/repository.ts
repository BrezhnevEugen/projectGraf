import { randomUUID } from 'node:crypto';
import type {
  ArchitectureReview,
  Graph,
  GraphEdge,
  GraphNode,
  Language,
  NodeDescription,
  ProviderName,
} from '@projectgraf/shared';
import type { DB } from './database.js';

export interface ProjectRow {
  id: string;
  root_path: string;
  created_at: string;
  last_scanned_at: string | null;
}

export interface FileRow {
  id: string;
  project_id: string;
  rel_path: string;
  abs_path: string;
  language: Language;
  mtime: number;
  hash: string | null;
}

export class Repository {
  constructor(private readonly db: DB) {}

  upsertProject(rootPath: string): ProjectRow {
    const existing = this.db
      .prepare<[string], ProjectRow>('SELECT * FROM projects WHERE root_path = ?')
      .get(rootPath);
    if (existing) return existing;

    const id = randomUUID();
    this.db
      .prepare('INSERT INTO projects (id, root_path) VALUES (?, ?)')
      .run(id, rootPath);
    return this.db
      .prepare<[string], ProjectRow>('SELECT * FROM projects WHERE id = ?')
      .get(id)!;
  }

  getProject(projectId: string): ProjectRow | undefined {
    return this.db
      .prepare<[string], ProjectRow>('SELECT * FROM projects WHERE id = ?')
      .get(projectId);
  }

  listProjects(): ProjectRow[] {
    return this.db
      .prepare<[], ProjectRow>('SELECT * FROM projects ORDER BY created_at DESC')
      .all();
  }

  markScanned(projectId: string): void {
    this.db
      .prepare("UPDATE projects SET last_scanned_at = datetime('now') WHERE id = ?")
      .run(projectId);
  }

  getFile(projectId: string, relPath: string): FileRow | undefined {
    return this.db
      .prepare<[string, string], FileRow>(
        'SELECT * FROM files WHERE project_id = ? AND rel_path = ?',
      )
      .get(projectId, relPath);
  }

  upsertFile(file: Omit<FileRow, 'id'> & { id?: string }): FileRow {
    const existing = this.getFile(file.project_id, file.rel_path);
    if (existing) {
      this.db
        .prepare('UPDATE files SET mtime = ?, hash = ?, language = ?, abs_path = ? WHERE id = ?')
        .run(file.mtime, file.hash ?? null, file.language, file.abs_path, existing.id);
      return { ...existing, mtime: file.mtime, hash: file.hash ?? null, language: file.language, abs_path: file.abs_path };
    }
    const id = file.id ?? randomUUID();
    this.db
      .prepare(
        'INSERT INTO files (id, project_id, rel_path, abs_path, language, mtime, hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(id, file.project_id, file.rel_path, file.abs_path, file.language, file.mtime, file.hash ?? null);
    return { ...file, id };
  }

  deleteFileGraph(fileId: string): void {
    this.db
      .prepare(
        "DELETE FROM edges WHERE source_id IN (SELECT id FROM nodes WHERE file_id = ?) OR target_id IN (SELECT id FROM nodes WHERE file_id = ?)",
      )
      .run(fileId, fileId);
    this.db.prepare('DELETE FROM nodes WHERE file_id = ?').run(fileId);
  }

  insertNodes(projectId: string, fileId: string, nodes: GraphNode[]): void {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO nodes (id, project_id, file_id, kind, name, language, parent_id, start_line, end_line, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    const tx = this.db.transaction((batch: GraphNode[]) => {
      for (const n of batch) {
        stmt.run(
          n.id,
          projectId,
          fileId,
          n.kind,
          n.name,
          n.language,
          n.parentId ?? null,
          n.location.startLine,
          n.location.endLine,
          JSON.stringify(n.metadata ?? {}),
        );
      }
    });
    tx(nodes);
  }

  insertEdges(projectId: string, edges: GraphEdge[]): void {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO edges (id, project_id, source_id, target_id, kind, resolved, raw_target) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    const tx = this.db.transaction((batch: GraphEdge[]) => {
      for (const e of batch) {
        stmt.run(
          e.id,
          projectId,
          e.sourceId,
          e.targetId || null,
          e.kind,
          e.resolved ? 1 : 0,
          e.rawTarget ?? null,
        );
      }
    });
    tx(edges);
  }

  loadGraph(projectId: string): Graph {
    const project = this.getProject(projectId);
    if (!project) throw new Error(`project ${projectId} not found`);

    type NodeRow = {
      id: string;
      kind: string;
      name: string;
      language: Language;
      parent_id: string | null;
      start_line: number;
      end_line: number;
      metadata: string;
      abs_path: string;
    };
    const nodeRows = this.db
      .prepare<[string], NodeRow>(
        `SELECT n.id, n.kind, n.name, n.language, n.parent_id, n.start_line, n.end_line, n.metadata, f.abs_path
         FROM nodes n JOIN files f ON f.id = n.file_id WHERE n.project_id = ?`,
      )
      .all(projectId);
    const nodes: GraphNode[] = nodeRows.map((r) => ({
      id: r.id,
      kind: r.kind as GraphNode['kind'],
      name: r.name,
      language: r.language,
      parentId: r.parent_id ?? undefined,
      location: { file: r.abs_path, startLine: r.start_line, endLine: r.end_line },
      metadata: JSON.parse(r.metadata),
    }));

    type EdgeRow = {
      id: string;
      source_id: string;
      target_id: string | null;
      kind: string;
      resolved: number;
      raw_target: string | null;
    };
    const edgeRows = this.db
      .prepare<[string], EdgeRow>(
        'SELECT id, source_id, target_id, kind, resolved, raw_target FROM edges WHERE project_id = ?',
      )
      .all(projectId);
    const edges: GraphEdge[] = edgeRows.map((r) => ({
      id: r.id,
      kind: r.kind as GraphEdge['kind'],
      sourceId: r.source_id,
      targetId: r.target_id ?? '',
      resolved: r.resolved === 1,
      rawTarget: r.raw_target ?? undefined,
    }));

    const stats = {
      files: this.db
        .prepare<[string], { c: number }>('SELECT COUNT(*) as c FROM files WHERE project_id = ?')
        .get(projectId)!.c,
      classes: nodes.filter((n) => n.kind === 'class' || n.kind === 'interface' || n.kind === 'trait').length,
      functions: nodes.filter((n) => n.kind === 'function' || n.kind === 'method').length,
      edgesTotal: edges.length,
    };

    return {
      projectId,
      rootPath: project.root_path,
      nodes,
      edges,
      scannedAt: project.last_scanned_at ?? new Date().toISOString(),
      stats,
    };
  }

  getNode(nodeId: string): (GraphNode & { projectId: string; fileAbsPath: string }) | undefined {
    type Row = {
      id: string;
      project_id: string;
      kind: string;
      name: string;
      language: Language;
      parent_id: string | null;
      start_line: number;
      end_line: number;
      metadata: string;
      abs_path: string;
    };
    const row = this.db
      .prepare<[string], Row>(
        `SELECT n.id, n.project_id, n.kind, n.name, n.language, n.parent_id, n.start_line, n.end_line, n.metadata, f.abs_path
         FROM nodes n JOIN files f ON f.id = n.file_id WHERE n.id = ?`,
      )
      .get(nodeId);
    if (!row) return undefined;
    return {
      id: row.id,
      projectId: row.project_id,
      fileAbsPath: row.abs_path,
      kind: row.kind as GraphNode['kind'],
      name: row.name,
      language: row.language,
      parentId: row.parent_id ?? undefined,
      location: { file: row.abs_path, startLine: row.start_line, endLine: row.end_line },
      metadata: JSON.parse(row.metadata),
    };
  }

  saveNodeDescription(d: NodeDescription): void {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO node_descriptions (node_id, summary, role, concerns, provider, model, generated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        d.nodeId,
        d.summary,
        d.role ?? null,
        d.concerns ? JSON.stringify(d.concerns) : null,
        d.provider,
        d.model,
        d.generatedAt,
      );
  }

  getNodeDescription(nodeId: string): NodeDescription | undefined {
    type Row = {
      node_id: string;
      summary: string;
      role: string | null;
      concerns: string | null;
      provider: string;
      model: string;
      generated_at: string;
    };
    const row = this.db
      .prepare<[string], Row>('SELECT * FROM node_descriptions WHERE node_id = ?')
      .get(nodeId);
    if (!row) return undefined;
    return {
      nodeId: row.node_id,
      summary: row.summary,
      role: row.role ?? undefined,
      concerns: row.concerns ? (JSON.parse(row.concerns) as string[]) : undefined,
      provider: row.provider as ProviderName,
      model: row.model,
      generatedAt: row.generated_at,
    };
  }

  saveReview(projectId: string, r: ArchitectureReview): void {
    this.db
      .prepare(
        'INSERT INTO architecture_reviews (id, project_id, highlights, risks, recommendations, provider, model, generated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        randomUUID(),
        projectId,
        JSON.stringify(r.highlights),
        JSON.stringify(r.risks),
        JSON.stringify(r.recommendations),
        r.provider,
        r.model,
        r.generatedAt,
      );
  }

  getLatestReview(projectId: string): ArchitectureReview | undefined {
    type Row = {
      highlights: string;
      risks: string;
      recommendations: string;
      provider: string;
      model: string;
      generated_at: string;
    };
    const row = this.db
      .prepare<[string], Row>(
        'SELECT highlights, risks, recommendations, provider, model, generated_at FROM architecture_reviews WHERE project_id = ? ORDER BY generated_at DESC LIMIT 1',
      )
      .get(projectId);
    if (!row) return undefined;
    return {
      highlights: JSON.parse(row.highlights) as string[],
      risks: JSON.parse(row.risks) as string[],
      recommendations: JSON.parse(row.recommendations) as string[],
      provider: row.provider as ProviderName,
      model: row.model,
      generatedAt: row.generated_at,
    };
  }

  resolveEdgesByName(projectId: string): void {
    const unresolved = this.db
      .prepare<[string], { id: string; raw_target: string | null; kind: string }>(
        "SELECT id, raw_target, kind FROM edges WHERE project_id = ? AND resolved = 0 AND raw_target IS NOT NULL",
      )
      .all(projectId);
    const findByName = this.db.prepare<[string, string], { id: string }>(
      "SELECT id FROM nodes WHERE project_id = ? AND name = ? LIMIT 1",
    );
    const findByPathSuffix = this.db.prepare<[string, string], { id: string }>(
      "SELECT id FROM nodes WHERE project_id = ? AND kind IN ('file','html_page') AND name LIKE ? LIMIT 1",
    );
    const update = this.db.prepare('UPDATE edges SET target_id = ?, resolved = 1 WHERE id = ?');
    const tx = this.db.transaction(() => {
      for (const e of unresolved) {
        if (!e.raw_target) continue;
        let match = findByName.get(projectId, e.raw_target);
        if (!match && /\.(php|phtml|js|mjs|cjs|html|htm|css)$/i.test(e.raw_target)) {
          let trimmed = e.raw_target;
          while (/^(\/|\.\.?\/)/.test(trimmed)) {
            trimmed = trimmed.replace(/^(\/|\.\.?\/)/, '');
          }
          match = findByPathSuffix.get(projectId, `%${trimmed}`);
        }
        if (match) update.run(match.id, e.id);
      }
    });
    tx();
  }
}
