import { Module } from '@nestjs/common';
import { DocumentJob } from '../../src/processing/queue/document-job.js';
import { QueueProvider } from '../../src/processing/queue/queue.provider.js';

/** Registra los trabajos encolados; activa `isUnavailable` para simular Redis caído. */
export class InMemoryQueueProvider extends QueueProvider {
  readonly jobs: DocumentJob[] = [];
  isUnavailable = false;

  enqueue(job: DocumentJob): Promise<void> {
    if (this.isUnavailable) {
      return Promise.reject(new Error('Queue unavailable'));
    }
    this.jobs.push(job);
    return Promise.resolve();
  }
}

@Module({
  providers: [{ provide: QueueProvider, useClass: InMemoryQueueProvider }],
  exports: [QueueProvider],
})
export class InMemoryQueueModule {}
