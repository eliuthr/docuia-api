import { Module } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { DocumentEventsSubscriber } from '../../src/documents/events/document-events.subscriber.js';
import { DocumentStatusEvent } from '../../src/documents/events/document-status-event.js';

/** Reemplaza a Redis en los tests e2e: `emit` simula un evento publicado por el worker. */
export class InMemoryDocumentEvents extends DocumentEventsSubscriber {
  private readonly statusEvents = new Subject<DocumentStatusEvent>();

  events(): Observable<DocumentStatusEvent> {
    return this.statusEvents.asObservable();
  }

  emit(event: DocumentStatusEvent): void {
    this.statusEvents.next(event);
  }
}

@Module({
  providers: [
    { provide: DocumentEventsSubscriber, useClass: InMemoryDocumentEvents },
  ],
  exports: [DocumentEventsSubscriber],
})
export class InMemoryDocumentEventsModule {}
