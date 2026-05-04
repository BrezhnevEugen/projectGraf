export type Language = 'php' | 'javascript' | 'html';

export type NodeKind =
  | 'file'
  | 'class'
  | 'interface'
  | 'trait'
  | 'function'
  | 'method'
  | 'property'
  | 'module'
  | 'html_page'
  | 'jquery_handler';

export type EdgeKind =
  | 'extends'
  | 'implements'
  | 'uses_trait'
  | 'imports'
  | 'requires'
  | 'includes'
  | 'calls'
  | 'instantiates'
  | 'references'
  | 'script_src'
  | 'link_href'
  | 'anchor_href'
  | 'jquery_selects';

export interface SourceLocation {
  file: string;
  startLine: number;
  endLine: number;
}

export interface GraphNode {
  id: string;
  kind: NodeKind;
  name: string;
  language: Language;
  location: SourceLocation;
  parentId?: string;
  metadata: {
    methodCount?: number;
    propertyCount?: number;
    loc?: number;
    visibility?: 'public' | 'protected' | 'private';
    isAbstract?: boolean;
    isFinal?: boolean;
    summary?: string;
  };
}

export interface GraphEdge {
  id: string;
  kind: EdgeKind;
  sourceId: string;
  targetId: string;
  resolved: boolean;
  rawTarget?: string;
}

export interface Graph {
  projectId: string;
  rootPath: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  scannedAt: string;
  stats: {
    files: number;
    classes: number;
    functions: number;
    edgesTotal: number;
  };
}
