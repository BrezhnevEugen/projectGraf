import type { GraphEdge } from '@projectgraf/shared';
import { parseSource, type SyntaxNode } from './treesitter.js';
import type { ParseInput, ParseResult } from './types.js';
import { makeEdgeId } from './util.js';

export function parseHtml(input: ParseInput): ParseResult {
  const tree = parseSource('html', input.source);
  const edges: GraphEdge[] = [];

  const tagOwners = [
    ...tree.rootNode.descendantsOfType('element'),
    ...tree.rootNode.descendantsOfType('script_element'),
    ...tree.rootNode.descendantsOfType('style_element'),
  ];
  for (const el of tagOwners) {
    const start = el.namedChildren.find((c) => c.type === 'start_tag' || c.type === 'self_closing_tag');
    if (!start) continue;
    const tagName = readTagName(start);
    if (!tagName) continue;

    if (tagName === 'script') {
      const src = attr(start, 'src');
      if (src) {
        edges.push({
          id: makeEdgeId([input.fileNodeId, 'script_src', src, String(el.startPosition.row)]),
          kind: 'script_src',
          sourceId: input.fileNodeId,
          targetId: '',
          rawTarget: src,
          resolved: false,
        });
      }
    } else if (tagName === 'link') {
      const href = attr(start, 'href');
      if (href) {
        edges.push({
          id: makeEdgeId([input.fileNodeId, 'link_href', href, String(el.startPosition.row)]),
          kind: 'link_href',
          sourceId: input.fileNodeId,
          targetId: '',
          rawTarget: href,
          resolved: false,
        });
      }
    } else if (tagName === 'a') {
      const href = attr(start, 'href');
      if (href && !href.startsWith('#') && !/^https?:/i.test(href) && !href.startsWith('mailto:')) {
        edges.push({
          id: makeEdgeId([input.fileNodeId, 'anchor_href', href, String(el.startPosition.row)]),
          kind: 'anchor_href',
          sourceId: input.fileNodeId,
          targetId: '',
          rawTarget: href,
          resolved: false,
        });
      }
    } else if (tagName === 'iframe' || tagName === 'embed') {
      const src = attr(start, 'src');
      if (src) {
        edges.push({
          id: makeEdgeId([input.fileNodeId, 'references', src, String(el.startPosition.row)]),
          kind: 'references',
          sourceId: input.fileNodeId,
          targetId: '',
          rawTarget: src,
          resolved: false,
        });
      }
    }
  }

  return { nodes: [], edges };
}

function readTagName(tag: SyntaxNode): string | null {
  for (const c of tag.namedChildren) {
    if (c.type === 'tag_name') return c.text.toLowerCase();
  }
  return null;
}

function attr(tag: SyntaxNode, name: string): string | null {
  for (const c of tag.namedChildren) {
    if (c.type !== 'attribute') continue;
    const an = c.namedChildren.find((a) => a.type === 'attribute_name');
    if (!an || an.text.toLowerCase() !== name) continue;
    const value = c.namedChildren.find(
      (a) => a.type === 'quoted_attribute_value' || a.type === 'attribute_value',
    );
    if (!value) return '';
    return value.text.replace(/^['"]|['"]$/g, '');
  }
  return null;
}
