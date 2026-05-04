import Parser from 'tree-sitter';
import PhpModule from 'tree-sitter-php';
import JavaScript from 'tree-sitter-javascript';
import Html from 'tree-sitter-html';
import type { Language } from '@projectgraf/shared';

// tree-sitter-php exports { php, php_only }; we want full PHP grammar.
const Php = (PhpModule as { php?: unknown; default?: unknown }).php ?? PhpModule;

const cache = new Map<Language, Parser>();

export function getParser(language: Language): Parser {
  let p = cache.get(language);
  if (p) return p;
  p = new Parser();
  switch (language) {
    case 'php':
      p.setLanguage(Php as Parser.Language);
      break;
    case 'javascript':
      p.setLanguage(JavaScript as unknown as Parser.Language);
      break;
    case 'html':
      p.setLanguage(Html as unknown as Parser.Language);
      break;
  }
  cache.set(language, p);
  return p;
}

export function parseSource(language: Language, source: string): Parser.Tree {
  return getParser(language).parse(source);
}

export type SyntaxNode = Parser.SyntaxNode;
