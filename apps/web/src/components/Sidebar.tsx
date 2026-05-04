import { useAppStore } from '../store/store.js';

export function Sidebar() {
  const detail = useAppStore((s) => s.selectedNodeDetail);
  const description = useAppStore((s) => s.description);
  const describeLoading = useAppStore((s) => s.describeLoading);
  const describeSelected = useAppStore((s) => s.describeSelected);

  if (!detail) {
    return (
      <div className="p-4 text-xs text-muted">
        Select a node to see its details.
      </div>
    );
  }

  const { node, incoming, outgoing, snippet } = detail;

  return (
    <div className="p-4 space-y-4 overflow-y-auto scrollbar">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted">{node.kind}</div>
        <div className="text-sm font-medium text-white break-all">{node.name}</div>
        <div className="text-xs text-muted mt-1 break-all">
          {node.fileAbsPath}:{node.location.startLine}-{node.location.endLine}
        </div>
      </div>

      {node.metadata && (
        <div className="text-xs grid grid-cols-2 gap-1 text-muted">
          {node.metadata.methodCount !== undefined && (
            <div>
              methods: <span className="text-white">{node.metadata.methodCount}</span>
            </div>
          )}
          {node.metadata.propertyCount !== undefined && (
            <div>
              props: <span className="text-white">{node.metadata.propertyCount}</span>
            </div>
          )}
          {node.metadata.loc !== undefined && (
            <div>
              loc: <span className="text-white">{node.metadata.loc}</span>
            </div>
          )}
          {node.metadata.visibility && (
            <div>
              visibility: <span className="text-white">{node.metadata.visibility}</span>
            </div>
          )}
          {node.metadata.isAbstract && <div className="text-amber-400">abstract</div>}
          {node.metadata.isFinal && <div className="text-emerald-400">final</div>}
        </div>
      )}

      <div className="flex gap-2">
        <button
          className="flex-1 px-3 py-2 bg-accent rounded text-sm font-medium hover:opacity-90 disabled:opacity-50"
          onClick={() => describeSelected(false)}
          disabled={describeLoading}
        >
          {describeLoading ? 'Asking AI…' : description ? 'Re-ask' : 'Describe with AI'}
        </button>
        {description && (
          <button
            className="px-3 py-2 bg-panel-2 border border-edge rounded text-sm hover:bg-edge"
            onClick={() => describeSelected(true)}
            disabled={describeLoading}
            title="Regenerate (bypass cache)"
          >
            ↻
          </button>
        )}
      </div>

      {description && (
        <div className="bg-panel-2 rounded p-3 text-xs space-y-2">
          {description.role && (
            <div>
              <span className="text-muted">role:</span>{' '}
              <span className="text-white">{description.role}</span>
            </div>
          )}
          <div className="text-white whitespace-pre-wrap">{description.summary}</div>
          {description.concerns && description.concerns.length > 0 && (
            <div>
              <div className="uppercase tracking-wider text-amber-400 text-[10px] mb-1">Concerns</div>
              <ul className="list-disc list-inside text-muted space-y-1">
                {description.concerns.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="text-[10px] text-muted flex justify-between">
            <span>
              via {description.provider} · {description.model}
            </span>
            {(description as { cached?: boolean }).cached && (
              <span className="text-accent-2">cached</span>
            )}
          </div>
        </div>
      )}

      <Section title={`Incoming (${incoming.length})`} edges={incoming} />
      <Section title={`Outgoing (${outgoing.length})`} edges={outgoing} />

      {snippet && (
        <div>
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Source</div>
          <pre className="bg-panel-2 rounded p-2 text-[11px] overflow-x-auto scrollbar text-emerald-200 max-h-72">
            {snippet}
          </pre>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  edges,
}: {
  title: string;
  edges: { id: string; kind: string; rawTarget?: string; targetId: string; sourceId: string }[];
}) {
  if (edges.length === 0) return null;
  return (
    <div className="text-xs">
      <div className="uppercase tracking-wider text-muted mb-1">{title}</div>
      <ul className="space-y-1">
        {edges.slice(0, 30).map((e) => (
          <li key={e.id} className="flex justify-between gap-2 truncate">
            <span className="text-muted">{e.kind}</span>
            <span className="text-white truncate" title={e.rawTarget ?? ''}>
              {e.rawTarget ?? e.targetId}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
