import type { GraphEdge, GraphNode } from '@projectgraf/shared';
import { parseSource, type SyntaxNode } from './treesitter.js';
import type { ParseInput, ParseResult } from './types.js';
import { locationFor, makeEdgeId, makeNodeId } from './util.js';

export function parsePhp(input: ParseInput): ParseResult {
  const tree = parseSource('php', input.source);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const ctx = {
    namespace: '',
    aliases: new Map<string, string>(),
  };

  collectAliases(tree.rootNode, ctx, input, edges);
  walk(tree.rootNode, null, ctx, input, nodes, edges);
  return { nodes, edges };
}

function collectAliases(root: SyntaxNode, ctx: PhpCtx, input: ParseInput, edges: GraphEdge[]): void {
  for (const ns of root.descendantsOfType('namespace_definition')) {
    const nameNode = child(ns, 'namespace_name');
    if (nameNode) ctx.namespace = textOf(nameNode);
  }
  for (const useDecl of root.descendantsOfType('namespace_use_declaration')) {
    for (const clause of useDecl.descendantsOfType('namespace_use_clause')) {
      const nameNode = child(clause, 'qualified_name') ?? child(clause, 'namespace_name');
      const aliasNode = child(clause, 'namespace_aliasing_clause');
      const fullName = textOf(nameNode).replace(/^\\/, '');
      if (!fullName) continue;
      const aliasName = aliasNode ? textOf(child(aliasNode, 'name')) : fullName.split('\\').pop();
      if (!aliasName) continue;
      ctx.aliases.set(aliasName, fullName);
      edges.push({
        id: makeEdgeId([input.relPath, 'imports', fullName]),
        kind: 'imports',
        sourceId: input.fileNodeId,
        targetId: '',
        rawTarget: fullName,
        resolved: false,
      });
    }
  }
}

interface PhpCtx {
  namespace: string;
  aliases: Map<string, string>;
}

function textOf(n: SyntaxNode | null | undefined): string {
  return n ? n.text : '';
}

function child(n: SyntaxNode, type: string): SyntaxNode | null {
  for (const c of n.namedChildren) {
    if (c.type === type) return c;
  }
  return null;
}

function children(n: SyntaxNode, type: string): SyntaxNode[] {
  return n.namedChildren.filter((c) => c.type === type);
}

function fqn(ctx: PhpCtx, raw: string): string {
  const trimmed = raw.replace(/^\\/, '');
  if (trimmed.includes('\\')) return trimmed;
  const aliased = ctx.aliases.get(trimmed);
  if (aliased) return aliased;
  return ctx.namespace ? `${ctx.namespace}\\${trimmed}` : trimmed;
}

function walk(
  node: SyntaxNode,
  parentId: string | null,
  ctx: PhpCtx,
  input: ParseInput,
  nodes: GraphNode[],
  edges: GraphEdge[],
): void {
  switch (node.type) {
    case 'namespace_definition':
    case 'namespace_use_declaration':
      // already processed in collectAliases pass
      for (const c of node.namedChildren) walk(c, parentId, ctx, input, nodes, edges);
      return;
    case 'class_declaration':
    case 'interface_declaration':
    case 'trait_declaration': {
      const nameNode = child(node, 'name');
      const name = textOf(nameNode);
      if (!name) return;
      const fullName = fqn(ctx, name);
      const id = makeNodeId([input.relPath, node.type, fullName]);

      const isAbstract = node.children.some((c) => c.type === 'abstract_modifier');
      const isFinal = node.children.some((c) => c.type === 'final_modifier');

      const kind =
        node.type === 'class_declaration'
          ? ('class' as const)
          : node.type === 'interface_declaration'
            ? ('interface' as const)
            : ('trait' as const);

      let methodCount = 0;
      let propertyCount = 0;
      const body = child(node, 'declaration_list');
      if (body) {
        methodCount = children(body, 'method_declaration').length;
        propertyCount = children(body, 'property_declaration').length;
      }

      nodes.push({
        id,
        kind,
        name: fullName,
        language: 'php',
        location: locationFor(input.absPath, node),
        parentId: parentId ?? input.fileNodeId,
        metadata: {
          methodCount,
          propertyCount,
          isAbstract,
          isFinal,
          loc: node.endPosition.row - node.startPosition.row + 1,
        },
      });

      const baseClause = child(node, 'base_clause');
      if (baseClause) {
        for (const ref of baseClause.namedChildren) {
          if (ref.type === 'name' || ref.type === 'qualified_name') {
            const target = fqn(ctx, textOf(ref).replace(/^\\/, ''));
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
      }
      const implClause = child(node, 'class_interface_clause');
      if (implClause) {
        for (const ref of implClause.namedChildren) {
          if (ref.type === 'name' || ref.type === 'qualified_name') {
            const target = fqn(ctx, textOf(ref).replace(/^\\/, ''));
            edges.push({
              id: makeEdgeId([id, 'implements', target]),
              kind: 'implements',
              sourceId: id,
              targetId: '',
              rawTarget: target,
              resolved: false,
            });
          }
        }
      }

      if (body) {
        for (const useDecl of children(body, 'use_declaration')) {
          for (const ref of useDecl.namedChildren) {
            if (ref.type === 'name' || ref.type === 'qualified_name') {
              const target = fqn(ctx, textOf(ref).replace(/^\\/, ''));
              edges.push({
                id: makeEdgeId([id, 'uses_trait', target]),
                kind: 'uses_trait',
                sourceId: id,
                targetId: '',
                rawTarget: target,
                resolved: false,
              });
            }
          }
        }
        for (const m of children(body, 'method_declaration')) {
          extractMethod(m, id, fullName, ctx, input, nodes);
        }
        for (const p of children(body, 'property_declaration')) {
          extractProperty(p, id, fullName, input, nodes);
        }
        for (const c of body.namedChildren) walkExpr(c, id, ctx, input, edges);
      }
      return;
    }
    case 'function_definition': {
      const nameNode = child(node, 'name');
      const name = textOf(nameNode);
      if (!name) return;
      const fullName = ctx.namespace ? `${ctx.namespace}\\${name}` : name;
      const id = makeNodeId([input.relPath, 'function', fullName]);
      nodes.push({
        id,
        kind: 'function',
        name: fullName,
        language: 'php',
        location: locationFor(input.absPath, node),
        parentId: input.fileNodeId,
        metadata: { loc: node.endPosition.row - node.startPosition.row + 1 },
      });
      walkExpr(node, id, ctx, input, edges);
      return;
    }
    default:
      walkExpr(node, parentId ?? input.fileNodeId, ctx, input, edges);
      for (const c of node.namedChildren) walk(c, parentId, ctx, input, nodes, edges);
  }
}

function extractMethod(
  node: SyntaxNode,
  classId: string,
  className: string,
  _ctx: PhpCtx,
  input: ParseInput,
  nodes: GraphNode[],
): void {
  const nameNode = child(node, 'name');
  const name = textOf(nameNode);
  if (!name) return;
  const id = makeNodeId([input.relPath, 'method', className, name]);
  let visibility: 'public' | 'protected' | 'private' = 'public';
  for (const c of node.children) {
    if (c.type === 'visibility_modifier') {
      const t = c.text;
      if (t === 'public' || t === 'protected' || t === 'private') visibility = t;
    }
  }
  nodes.push({
    id,
    kind: 'method',
    name: `${className}::${name}`,
    language: 'php',
    location: locationFor(input.absPath, node),
    parentId: classId,
    metadata: {
      visibility,
      loc: node.endPosition.row - node.startPosition.row + 1,
    },
  });
}

function extractProperty(
  node: SyntaxNode,
  classId: string,
  className: string,
  input: ParseInput,
  nodes: GraphNode[],
): void {
  let visibility: 'public' | 'protected' | 'private' = 'public';
  for (const c of node.children) {
    if (c.type === 'visibility_modifier') {
      const t = c.text;
      if (t === 'public' || t === 'protected' || t === 'private') visibility = t;
    }
  }
  for (const el of node.descendantsOfType('property_element')) {
    const varName = textOf(el.namedChildren[0]);
    if (!varName) continue;
    const id = makeNodeId([input.relPath, 'property', className, varName]);
    nodes.push({
      id,
      kind: 'property',
      name: `${className}::${varName}`,
      language: 'php',
      location: locationFor(input.absPath, el),
      parentId: classId,
      metadata: { visibility },
    });
  }
}

function walkExpr(node: SyntaxNode, sourceId: string, ctx: PhpCtx, input: ParseInput, edges: GraphEdge[]): void {
  for (const occ of node.descendantsOfType('object_creation_expression')) {
    const className = occ.namedChildren.find((c) => c.type === 'name' || c.type === 'qualified_name');
    if (!className) continue;
    const target = fqn(ctx, textOf(className).replace(/^\\/, ''));
    edges.push({
      id: makeEdgeId([sourceId, 'instantiates', target, String(occ.startPosition.row)]),
      kind: 'instantiates',
      sourceId,
      targetId: '',
      rawTarget: target,
      resolved: false,
    });
  }
  for (const incl of [
    ...node.descendantsOfType('include_expression'),
    ...node.descendantsOfType('include_once_expression'),
    ...node.descendantsOfType('require_expression'),
    ...node.descendantsOfType('require_once_expression'),
  ]) {
    const literal = incl.descendantsOfType('string').find((s) => s.text);
    if (!literal) continue;
    const raw = literal.text.replace(/^['"]|['"]$/g, '');
    const kind = incl.type.startsWith('include') ? 'includes' : 'requires';
    edges.push({
      id: makeEdgeId([sourceId, kind, raw, String(incl.startPosition.row)]),
      kind,
      sourceId,
      targetId: '',
      rawTarget: raw,
      resolved: false,
    });
  }
}
