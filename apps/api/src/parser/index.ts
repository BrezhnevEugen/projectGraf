import type { GraphNode, Language } from '@projectgraf/shared';
import { parsePhp } from './php.js';
import { parseJavascript } from './javascript.js';
import { parseHtml } from './html.js';
import type { ParseInput, ParseResult } from './types.js';
import { makeNodeId } from './util.js';

export function buildFileNode(input: { absPath: string; relPath: string; language: Language; loc: number }): GraphNode {
  return {
    id: makeNodeId([input.relPath, 'file']),
    kind: input.language === 'html' ? 'html_page' : 'file',
    name: input.relPath,
    language: input.language,
    location: { file: input.absPath, startLine: 1, endLine: input.loc },
    metadata: { loc: input.loc },
  };
}

export function parseByLanguage(language: Language, input: ParseInput): ParseResult {
  switch (language) {
    case 'php':
      return parsePhp(input);
    case 'javascript':
      return parseJavascript(input);
    case 'html':
      return parseHtml(input);
  }
}
