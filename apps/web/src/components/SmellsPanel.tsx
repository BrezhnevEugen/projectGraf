import { useAppStore } from '../store/store.js';

const SEVERITY: Record<string, string> = {
  info: 'text-accent-2',
  warning: 'text-amber-400',
  error: 'text-red-400',
};

export function SmellsPanel() {
  const smells = useAppStore((s) => s.smells);
  const selectNode = useAppStore((s) => s.selectNode);

  if (smells.length === 0) {
    return <div className="p-4 text-xs text-muted">No architectural smells detected.</div>;
  }

  return (
    <div className="p-4 space-y-2">
      <div className="text-xs uppercase tracking-wider text-muted">Smells ({smells.length})</div>
      <ul className="space-y-1">
        {smells.map((s) => (
          <li
            key={s.id}
            className="text-xs bg-panel-2 rounded p-2 cursor-pointer hover:bg-edge"
            onClick={() => s.nodeIds[0] && selectNode(s.nodeIds[0])}
          >
            <div className={`uppercase tracking-wider text-[10px] ${SEVERITY[s.severity] ?? ''}`}>
              {s.kind}
            </div>
            <div className="text-white">{s.message}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
