import { createHash } from 'node:crypto';
import type { SourceLocation } from '@projectgraf/shared';

export function shortHash(input: string): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 12);
}

export function makeNodeId(parts: string[]): string {
  return shortHash(parts.join('|'));
}

export function makeEdgeId(parts: string[]): string {
  return shortHash(['edge', ...parts].join('|'));
}

export interface SyntaxLikeNode {
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
}

export function locationFor(file: string, n: SyntaxLikeNode): SourceLocation {
  return {
    file,
    startLine: n.startPosition.row + 1,
    endLine: n.endPosition.row + 1,
  };
}
