# ProjectGraf

Local source-code analyzer that visualizes architectural relationships (inheritance, dependencies, composition) as an interactive graph with AI-driven analysis.

**Status:** early development.

## Supported languages

- PHP
- JavaScript (incl. jQuery patterns)
- HTML

## AI providers

Pluggable through a common `LLMProvider` interface:

- Ollama (local)
- DeepSeek
- OpenAI
- Anthropic Claude
- OpenRouter

## Stack

| Layer | Tech |
| --- | --- |
| Runtime | Node.js 20+ / TypeScript |
| Parser | tree-sitter (PHP, JS, HTML grammars) |
| Storage | SQLite (better-sqlite3) |
| API | Fastify + WebSocket |
| UI | React 18 + Vite + React Flow + Zustand + Tailwind |

## Layout

```
projectGraf/
├── apps/
│   ├── api/        # Fastify backend: scanner, parser, AI enricher, SQLite cache
│   ├── web/        # React frontend: graph, sidebar, settings
│   └── desktop/    # Electron wrapper with native folder picker
└── packages/
    └── shared/     # Common TS types (Graph, Node, Edge, LLMProvider)
```

## Quick start

```bash
npm install
npm run dev        # api on :4000, web on :5173
npm run desktop    # same + Electron window with native folder picker
```

## Roadmap

1. Bootstrap monorepo
2. Scanner + tree-sitter parsers (PHP first)
3. SQLite cache with incremental re-parse
4. REST + WebSocket API
5. React Flow UI with sidebar
6. LLM provider layer
7. Smell detectors (circular deps, God Objects)
