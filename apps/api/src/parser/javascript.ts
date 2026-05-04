import type { GraphEdge, GraphNode } from '@projectgraf/shared';
import { parseSource, type SyntaxNode } from './treesitter.js';
import type { ParseInput, ParseResult } from './types.js';
import { locationFor, makeEdgeId, makeNodeId } from './util.js';

export function parseJavascript(input: ParseInput): ParseResult {
  const tree = parseSource('javascript', input.source);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  walk(tree.rootNode, input.fileNodeId, input, nodes, edges);

  for (const n of tree.rootNode.descendantsOfType('call_expression')) {
    extractJqueryCalls(n, input, edges);
  }
  return { nodes, edges };
}

function textOf(n: SyntaxNode | null | undefined): string {
  return n ? n.text : '';
}

function child(n: SyntaxNode, type: string): SyntaxNode | null {
  for (const c of n.namedChildren) if (c.type === type) return c;
  return null;
}

function walk(
  node: SyntaxNode,
  parentId: string,
  input: ParseInput,
  nodes: GraphNode[],
  edges: GraphEdge[],
): void {
  for (const n of node.namedChildren) {
    if (n.type === 'class_declaration') extractClass(n, parentId, input, nodes, edges);
    else if (n.type === 'function_declaration') extractFunction(n, parentId, input, nodes);
    else if (n.type === 'import_statement') extractImport(n, input, edges);
    else if (
      n.type === 'lexical_declaration' ||
      n.type === 'variable_declaration' ||
      n.type === 'expression_statement'
    ) {
      extractRequires(n, input, edges);
      walk(n, parentId, input, nodes, edges);
    } else {
      walk(n, parentId, input, nodes, edges);
    }
  }
}

function extractClass(
  node: SyntaxNode,
  parentId: string,
  input: ParseInput,
  nodes: GraphNode[],
  edges: GraphEdge[],
): void {
  const nameNode = child(node, 'identifier') ?? child(node, 'type_identifier');
  const name = textOf(nameNode) || '<anonymous>';
  const id = makeNodeId([input.relPath, 'class', name]);

  let methodCount = 0;
  let propertyCount = 0;
  const body = child(node, 'class_body');
  if (body) {
    for (const c of body.namedChildren) {
      if (c.type === 'method_definition') methodCount++;
      else if (c.type === 'public_field_definition' || c.type === 'field_definition') propertyCount++;
    }
  }

  nodes.push({
    id,
    kind: 'class',
    name,
    language: 'javascript',
    location: locationFor(input.absPath, node),
    parentId,
    metadata: {
      methodCount,
      propertyCount,
      loc: node.endPosition.row - node.startPosition.row + 1,
    },
  });

  const heritage = child(node, 'class_heritage');
  if (heritage) {
    const ext = heritage.namedChildren[0];
    if (ext) {
      const target = textOf(ext);
      edges.push({
        id: makeEdgeId([id, 'extends', target]),
        kind: 'extends',
        sourceId: id,
        targetId: '',
        rawTarget: target,
        resolved: false,
      });
    }
  }

  if (body) {
    for (const m of body.namedChildren) {
      if (m.type === 'method_definition') {
        const mName = textOf(child(m, 'property_identifier'));
        if (!mName) continue;
        nodes.push({
          id: makeNodeId([input.relPath, 'method', name, mName]),
          kind: 'method',
          name: `${name}.${mName}`,
          language: 'javascript',
          location: locationFor(input.absPath, m),
          parentId: id,
          metadata: { loc: m.endPosition.row - m.startPosition.row + 1 },
        });
      }
    }
  }

  for (const occ of node.descendantsOfType('new_expression')) {
    const target = textOf(child(occ, 'identifier'));
    if (!target) continue;
    edges.push({
      id: makeEdgeId([id, 'instantiates', target, String(occ.startPosition.row)]),
      kind: 'instantiates',
      sourceId: id,
      targetId: '',
      rawTarget: target,
      resolved: false,
    });
  }
}

function extractFunction(node: SyntaxNode, parentId: string, input: ParseInput, nodes: GraphNode[]): void {
  const name = textOf(child(node, 'identifier'));
  if (!name) return;
  nodes.push({
    id: makeNodeId([input.relPath, 'function', name]),
    kind: 'function',
    name,
    language: 'javascript',
    location: locationFor(input.absPath, node),
    parentId,
    metadata: { loc: node.endPosition.row - node.startPosition.row + 1 },
  });
}

function extractImport(node: SyntaxNode, input: ParseInput, edges: GraphEdge[]): void {
  const source = node.descendantsOfType('string').find((s) => s.text);
  if (!source) return;
  const raw = source.text.replace(/^['"`]|['"`]$/g, '');
  edges.push({
    id: makeEdgeId([input.fileNodeId, 'imports', raw]),
    kind: 'imports',
    sourceId: input.fileNodeId,
    targetId: '',
    rawTarget: raw,
    resolved: false,
  });
}

function extractRequires(node: SyntaxNode, input: ParseInput, edges: GraphEdge[]): void {
  for (const call of node.descendantsOfType('call_expression')) {
    const fn = child(call, 'identifier');
    if (!fn || fn.text !== 'require') continue;
    const args = child(call, 'arguments');
    if (!args) continue;
    const first = args.namedChildren[0];
    if (!first || first.type !== 'string') continue;
    const raw = first.text.replace(/^['"`]|['"`]$/g, '');
    edges.push({
      id: makeEdgeId([input.fileNodeId, 'requires', raw, String(call.startPosition.row)]),
      kind: 'requires',
      sourceId: input.fileNodeId,
      targetId: '',
      rawTarget: raw,
      resolved: false,
    });
  }
}

function extractJqueryCalls(call: SyntaxNode, input: ParseInput, edges: GraphEdge[]): void {
  const fn = call.namedChildren[0];
  if (!fn) return;
  const isDollar =
    (fn.type === 'identifier' && (fn.text === '$' || fn.text === 'jQuery')) ||
    (fn.type === 'member_expression' &&
      ['$', 'jQuery'].includes(textOf(child(fn, 'identifier'))));

  if (!isDollar) return;
  const args = child(call, 'arguments');
  if (!args) return;
  const first = args.namedChildren[0];
  if (!first || first.type !== 'string') return;
  const sel = first.text.replace(/^['"`]|['"`]$/g, '');
  if (!sel) return;

  edges.push({
    id: makeEdgeId([input.fileNodeId, 'jquery_selects', sel, String(call.startPosition.row)]),
    kind: 'jquery_selects',
    sourceId: input.fileNodeId,
    targetId: '',
    rawTarget: sel,
    resolved: false,
  });
}
