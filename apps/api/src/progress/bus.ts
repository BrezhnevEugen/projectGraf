import { EventEmitter } from 'node:events';
import type { ProgressEvent } from '@projectgraf/shared';

export class ProgressBus extends EventEmitter {
  emitEvent(event: ProgressEvent): void {
    this.emit('event', event);
    this.emit(`project:${event.projectId}`, event);
  }
}
