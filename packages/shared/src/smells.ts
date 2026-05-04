export type SmellKind = 'circular_dependency' | 'god_object' | 'orphan' | 'high_fanout' | 'high_fanin';

export interface Smell {
  id: string;
  kind: SmellKind;
  severity: 'info' | 'warning' | 'error';
  nodeIds: string[];
  message: string;
  metric?: number;
}
