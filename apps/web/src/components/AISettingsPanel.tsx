import type { ProviderName } from '@projectgraf/shared';
import { useAppStore } from '../store/store.js';

const PROVIDER_DEFAULTS: Record<ProviderName, { model: string; needsKey: boolean; baseUrl?: string }> = {
  ollama: { model: 'llama3.1', needsKey: false, baseUrl: 'http://localhost:11434/v1' },
  deepseek: { model: 'deepseek-chat', needsKey: true },
  openai: { model: 'gpt-4o-mini', needsKey: true },
  anthropic: { model: 'claude-sonnet-4-6', needsKey: true },
  openrouter: { model: 'anthropic/claude-3.5-sonnet', needsKey: true },
};

export function AISettingsPanel() {
  const provider = useAppStore((s) => s.provider);
  const setProvider = useAppStore((s) => s.setProvider);
  const runReview = useAppStore((s) => s.runReview);
  const review = useAppStore((s) => s.review);
  const reviewLoading = useAppStore((s) => s.reviewLoading);
  const currentProjectId = useAppStore((s) => s.currentProjectId);

  const def = PROVIDER_DEFAULTS[provider.name];

  return (
    <div className="p-4 border-b border-edge bg-panel">
      <div className="text-xs uppercase tracking-wider text-muted mb-2">AI provider</div>
      <select
        className="w-full bg-panel-2 border border-edge rounded px-2 py-1 text-sm mb-2"
        value={provider.name}
        onChange={(e) => {
          const name = e.target.value as ProviderName;
          const next = PROVIDER_DEFAULTS[name];
          setProvider({ name, model: next.model, baseUrl: next.baseUrl });
        }}
      >
        <option value="ollama">Ollama (local)</option>
        <option value="deepseek">DeepSeek</option>
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic Claude</option>
        <option value="openrouter">OpenRouter</option>
      </select>
      <input
        className="w-full bg-panel-2 border border-edge rounded px-2 py-1 text-sm mb-2"
        placeholder="model"
        value={provider.model}
        onChange={(e) => setProvider({ ...provider, model: e.target.value })}
      />
      {def.needsKey && (
        <input
          type="password"
          className="w-full bg-panel-2 border border-edge rounded px-2 py-1 text-sm mb-2"
          placeholder="API key"
          value={provider.apiKey ?? ''}
          onChange={(e) => setProvider({ ...provider, apiKey: e.target.value })}
        />
      )}
      <input
        className="w-full bg-panel-2 border border-edge rounded px-2 py-1 text-sm mb-3"
        placeholder={`Base URL (default: ${def.baseUrl ?? 'provider default'})`}
        value={provider.baseUrl ?? ''}
        onChange={(e) => setProvider({ ...provider, baseUrl: e.target.value || undefined })}
      />

      <button
        className="w-full px-3 py-2 bg-accent-2 text-ink rounded text-sm font-medium hover:opacity-90 disabled:opacity-50"
        disabled={!currentProjectId || reviewLoading}
        onClick={() => runReview()}
      >
        {reviewLoading ? 'Reviewing…' : 'Run architecture review'}
      </button>

      {review && (
        <div className="mt-3 text-xs space-y-2">
          {review.highlights.length > 0 && (
            <Section title="Highlights" items={review.highlights} color="text-emerald-400" />
          )}
          {review.risks.length > 0 && (
            <Section title="Risks" items={review.risks} color="text-amber-400" />
          )}
          {review.recommendations.length > 0 && (
            <Section title="Recommendations" items={review.recommendations} color="text-accent-2" />
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div>
      <div className={`uppercase tracking-wider ${color} mb-1`}>{title}</div>
      <ul className="list-disc list-inside space-y-1 text-muted">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
