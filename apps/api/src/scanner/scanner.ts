import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, sep } from 'node:path';
import fg from 'fast-glob';
import type { Language } from '@projectgraf/shared';

interface IgnoreInstance {
  add(patterns: string | readonly string[]): IgnoreInstance;
  ignores(pathname: string): boolean;
}
const require = createRequire(import.meta.url);
const ignore: () => IgnoreInstance = require('ignore');

const DEFAULT_IGNORES = [
  'node_modules',
  'vendor',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.cache',
  '.idea',
  '.vscode',
];

const EXT_TO_LANG: Record<string, Language> = {
  '.php': 'php',
  '.phtml': 'php',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.html': 'html',
  '.htm': 'html',
};

export interface ScannedFile {
  absPath: string;
  relPath: string;
  language: Language;
  mtime: number;
  size: number;
}

export interface ScanOptions {
  rootPath: string;
  languages?: Language[];
  extraIgnores?: string[];
  respectGitignore?: boolean;
}

function loadGitignore(rootPath: string): ReturnType<typeof ignore> {
  const ig = ignore();
  ig.add(DEFAULT_IGNORES);
  const gitignorePath = join(rootPath, '.gitignore');
  if (existsSync(gitignorePath)) {
    ig.add(readFileSync(gitignorePath, 'utf8'));
  }
  return ig;
}

export async function scanFiles(options: ScanOptions): Promise<ScannedFile[]> {
  const langs = new Set<Language>(options.languages ?? ['php', 'javascript', 'html']);
  const exts = Object.entries(EXT_TO_LANG)
    .filter(([, lang]) => langs.has(lang))
    .map(([ext]) => ext.slice(1));

  if (exts.length === 0) return [];

  const pattern = `**/*.{${exts.join(',')}}`;
  const ig = options.respectGitignore === false ? ignore().add(DEFAULT_IGNORES) : loadGitignore(options.rootPath);
  if (options.extraIgnores) ig.add(options.extraIgnores);

  const entries = await fg(pattern, {
    cwd: options.rootPath,
    absolute: true,
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: false,
    suppressErrors: true,
  });

  const out: ScannedFile[] = [];
  for (const abs of entries) {
    const rel = relative(options.rootPath, abs).split(sep).join('/');
    if (ig.ignores(rel)) continue;
    const ext = abs.slice(abs.lastIndexOf('.')).toLowerCase();
    const lang = EXT_TO_LANG[ext];
    if (!lang) continue;
    try {
      const s = await stat(abs);
      out.push({
        absPath: abs,
        relPath: rel,
        language: lang,
        mtime: Math.floor(s.mtimeMs),
        size: s.size,
      });
    } catch {
      // file disappeared between glob and stat
    }
  }
  return out;
}

export async function readSource(absPath: string): Promise<string> {
  return readFile(absPath, 'utf8');
}
