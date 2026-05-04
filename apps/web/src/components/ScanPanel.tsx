import { useEffect, useState } from 'react';
import { useAppStore } from '../store/store.js';
import { isElectron, selectDirectory } from '../api/electron.js';

export function ScanPanel() {
  const [rootPath, setRootPath] = useState('');
  const [force, setForce] = useState(false);
  const startScan = useAppStore((s) => s.startScan);
  const refreshProjects = useAppStore((s) => s.refreshProjects);
  const loadGraph = useAppStore((s) => s.loadGraph);
  const loadSmells = useAppStore((s) => s.loadSmells);
  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const progress = useAppStore((s) => s.scanProgress);

  useEffect(() => {
    refreshProjects().catch(() => undefined);
  }, [refreshProjects]);

  return (
    <div className="p-4 border-b border-edge bg-panel">
      <div className="text-xs uppercase tracking-wider text-muted mb-2">Scan project</div>
      <div className="flex gap-2 mb-2">
        <input
          className="flex-1 bg-panel-2 border border-edge rounded px-3 py-2 text-sm"
          placeholder="/absolute/path/to/your/project"
          value={rootPath}
          onChange={(e) => setRootPath(e.target.value)}
        />
        {isElectron() && (
          <button
            className="px-3 py-2 bg-panel-2 border border-edge rounded text-sm hover:bg-edge"
            title="Browse for folder"
            onClick={async () => {
              const picked = await selectDirectory();
              if (picked) setRootPath(picked);
            }}
          >
            …
          </button>
        )}
        <button
          className="px-3 py-2 bg-accent rounded text-sm font-medium hover:opacity-90 disabled:opacity-50"
          disabled={!rootPath || progress.active}
          onClick={() => startScan({ rootPath, force })}
        >
          {progress.active ? 'Scanning…' : 'Scan'}
        </button>
      </div>
      <label className="text-xs text-muted flex items-center gap-2">
        <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
        Force re-parse all files
      </label>

      {progress.total > 0 && (
        <div className="mt-3 text-xs">
          <div className="flex justify-between text-muted mb-1">
            <span>
              {progress.current}/{progress.total}
            </span>
            <span className="truncate ml-2 max-w-[60%] text-right">{progress.lastFile ?? ''}</span>
          </div>
          <div className="h-1 bg-panel-2 rounded">
            <div
              className="h-full bg-accent rounded transition-all"
              style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
          {progress.durationMs !== undefined && !progress.active && (
            <div className="text-muted mt-1">Done in {(progress.durationMs / 1000).toFixed(1)}s</div>
          )}
          {progress.error && <div className="text-red-400 mt-1">{progress.error}</div>}
        </div>
      )}

      {projects.length > 0 && (
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Projects</div>
          <ul className="space-y-1 max-h-40 overflow-y-auto scrollbar">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  className={`w-full text-left px-2 py-1 rounded text-xs hover:bg-panel-2 truncate ${
                    p.id === currentProjectId ? 'bg-panel-2 text-white' : 'text-muted'
                  }`}
                  onClick={() => {
                    loadGraph(p.id).then(() => loadSmells());
                  }}
                  title={p.root_path}
                >
                  {p.root_path}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
