import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Env } from '../../config/env.schema.js';
import {
  DOCUMENT_PROCESSING_QUEUE,
  DocumentJob,
  PROCESS_DOCUMENT_JOB,
} from './document-job.js';
import { QueueProvider } from './queue.provider.js';

/** Trabajos fallidos que se guardan en Redis para revisarlos antes de borrar los más antiguos. */
const MAX_FAILED_JOBS_KEPT = 1000;

@Injectable()
export class BullmqQueueProvider extends QueueProvider {
  constructor(
    @InjectQueue(DOCUMENT_PROCESSING_QUEUE)
    private readonly queue: Queue<DocumentJob>,
    private readonly config: ConfigService<Env, true>,
  ) {
    super();
  }

  async enqueue(job: DocumentJob): Promise<void> {
    await this.queue.add(PROCESS_DOCUMENT_JOB, job, {
      // Mismo id para el mismo documento, así encolarlo dos veces deja un solo trabajo.
      jobId: job.documentId,
      attempts: this.config.get('PROCESSING_MAX_ATTEMPTS', { infer: true }),
      backoff: {
        type: 'exponential',
        delay: this.config.get('PROCESSING_BACKOFF_MS', { infer: true }),
      },
      removeOnComplete: true,
      removeOnFail: { count: MAX_FAILED_JOBS_KEPT },
    });
  }
}
