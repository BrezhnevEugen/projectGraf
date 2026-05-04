import { useState } from 'react';
import { GraphCanvas } from './components/GraphCanvas.js';
import { Graph3DCanvas } from './components/Graph3DCanvas.js';
import { Sidebar } from './components/Sidebar.js';
import { ScanPanel } from './components/ScanPanel.js';
import { AISettingsPanel } from './components/AISettingsPanel.js';
import { SmellsPanel } from './components/SmellsPanel.js';
import { useAppStore } from './store/store.js';

type Tab = 'details' | 'smells';
type View = '2d' | '3d';

export default function App() {
  const [tab, setTab] = useState<Tab>('details');
  const [view, setView] = useState<View>('2d');
  const graph = useAppStore((s) => s.graph);

  return (
    <div className="h-full grid grid-cols-[320px_1fr_360px]">
      <aside className="border-r border-edge bg-panel overflow-y-auto scrollbar">
        <header className="p-4 border-b border-edge flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent" />
          <div className="font-semibold tracking-tight">ProjectGraf</div>
        </header>
        <ScanPanel />
        <AISettingsPanel />
      </aside>

      <main className="relative">
        {graph && (
          <div className="absolute top-3 left-3 z-10 text-xs bg-panel/80 border border-edge rounded px-2 py-1 text-muted">
            {graph.stats.files} files · {graph.stats.classes} classes · {graph.stats.functions} fns ·{' '}
            {graph.stats.edgesTotal} edges
          </div>
        )}
        <div className="absolute top-3 right-3 z-10 flex bg-panel/80 border border-edge rounded text-xs">
          <button
            className={`px-3 py-1 ${view === '2d' ? 'bg-panel-2 text-white' : 'text-muted'}`}
            onClick={() => setView('2d')}
          >
            2D
          </button>
          <button
            className={`px-3 py-1 ${view === '3d' ? 'bg-panel-2 text-white' : 'text-muted'}`}
            onClick={() => setView('3d')}
          >
            3D
          </button>
        </div>
        {view === '2d' ? <GraphCanvas /> : <Graph3DCanvas />}
      </main>

      <aside className="border-l border-edge bg-panel flex flex-col overflow-hidden">
        <div className="flex border-b border-edge text-xs">
          <button
            className={`flex-1 py-2 ${tab === 'details' ? 'bg-panel-2 text-white' : 'text-muted'}`}
            onClick={() => setTab('details')}
          >
            Details
          </button>
          <button
            className={`flex-1 py-2 ${tab === 'smells' ? 'bg-panel-2 text-white' : 'text-muted'}`}
            onClick={() => setTab('smells')}
          >
            Smells
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {tab === 'details' ? <Sidebar /> : <SmellsPanel />}
        </div>
      </aside>
    </div>
  );
}
