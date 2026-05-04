import { performance } from 'node:perf_hooks';
import type { ScanRequest } from '@projectgraf/shared';
import { Repository } from '../db/repository.js';
import type { DB } from '../db/database.js';
import { readSource, scanFiles } from '../scanner/scanner.js';
import { buildFileNode, parseByLanguage } from '../parser/index.js';
import { ProgressBus } from '../progress/bus.js';

export interface ScanServiceDeps {
  db: DB;
  progress: ProgressBus;
}

export class ScanService {
  private readonly repo: Repository;

  constructor(private readonly deps: ScanServiceDeps) {
    this.repo = new Repository(deps.db);
  }

  async scan(req: ScanRequest): Promise<{ projectId: string; filesQueued: number }> {
    const project = this.repo.upsertProject(req.rootPath);
    const files = await scanFiles({
      rootPath: req.rootPath,
      languages: req.languages,
      respectGitignore: req.respectGitignore,
      extraIgnores: req.ignore,
    });

    this.deps.progress.emitEvent({ type: 'scan:start', projectId: project.id, total: files.length });

    const start = performance.now();
    let index = 0;
    for (const file of files) {
      index++;
      try {
        const cached = this.repo.getFile(project.id, file.relPath);
        if (cached && !req.force && cached.mtime === file.mtime) {
          this.deps.progress.emitEvent({
            type: 'scan:file',
            projectId: project.id,
            file: file.relPath,
            index,
            total: files.length,
          });
          continue;
        }

        const source = await readSource(file.absPath);
        const fileRow = this.repo.upsertFile({
          project_id: project.id,
          rel_path: file.relPath,
          abs_path: file.absPath,
          language: file.language,
          mtime: file.mtime,
          hash: null,
        });

        if (cached) this.repo.deleteFileGraph(fileRow.id);

        const fileNode = buildFileNode({
          absPath: file.absPath,
          relPath: file.relPath,
          language: file.language,
          loc: source.split('\n').length,
        });
        const result = parseByLanguage(file.language, {
          absPath: file.absPath,
          relPath: file.relPath,
          source,
          fileNodeId: fileNode.id,
        });
        this.repo.insertNodes(project.id, fileRow.id, [fileNode, ...result.nodes]);
        this.repo.insertEdges(project.id, result.edges);

        this.deps.progress.emitEvent({
          type: 'scan:file',
          projectId: project.id,
          file: file.relPath,
          index,
          total: files.length,
        });
      } catch (err) {
        this.deps.progress.emitEvent({
          type: 'scan:error',
          projectId: project.id,
          file: file.relPath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.repo.resolveEdgesByName(project.id);
    this.repo.markScanned(project.id);

    this.deps.progress.emitEvent({
      type: 'scan:done',
      projectId: project.id,
      durationMs: Math.round(performance.now() - start),
    });

    return { projectId: project.id, filesQueued: files.length };
  }
}
