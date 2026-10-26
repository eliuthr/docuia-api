import { Logger } from '@nestjs/common';
import { DocumentJobRunner } from './document-job.runner.js';
import { DocumentProcessingService } from './document-processing.service.js';
import { DataExtractionFailedError } from './errors/data-extraction-failed.error.js';
import { GENERIC_FAILURE_REASON } from './errors/permanent-processing.error.js';
import { UnreadableDocumentError } from './errors/unreadable-document.error.js';

const MAX_ATTEMPTS = 3;

function attempt(number: number) {
  return { documentId: 'doc-1', attempt: number, maxAttempts: MAX_ATTEMPTS };
}

describe('DocumentJobRunner', () => {
  let processing: {
    process: ReturnType<typeof vi.fn>;
    markFailed: ReturnType<typeof vi.fn>;
  };
  let runner: DocumentJobRunner;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    processing = {
      process: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    runner = new DocumentJobRunner(
      processing as unknown as DocumentProcessingService,
    );
  });

  it('processes the document', async () => {
    await expect(runner.run(attempt(1))).resolves.toEqual({ kind: 'done' });

    expect(processing.process).toHaveBeenCalledWith('doc-1');
  });

  it('asks for a retry on a transient error while attempts remain', async () => {
    const failure = new Error('storage timeout');
    processing.process.mockRejectedValue(failure);

    await expect(runner.run(attempt(1))).resolves.toEqual({
      kind: 'retry',
      error: failure,
    });
    expect(processing.markFailed).not.toHaveBeenCalled();
  });

  it('marks the document failed on the last attempt with a generic reason', async () => {
    processing.process.mockRejectedValue(new Error('storage timeout'));

    await expect(runner.run(attempt(MAX_ATTEMPTS))).resolves.toEqual({
      kind: 'failed',
      message: 'storage timeout',
    });
    expect(processing.markFailed).toHaveBeenCalledWith(
      'doc-1',
      GENERIC_FAILURE_REASON,
    );
  });

  it('fails an unreadable document immediately with its own reason', async () => {
    processing.process.mockRejectedValue(
      new UnreadableDocumentError('The PDF file is corrupt or cannot be read.'),
    );

    const outcome = await runner.run(attempt(1));

    expect(outcome.kind).toBe('failed');
    expect(processing.markFailed).toHaveBeenCalledWith(
      'doc-1',
      'The PDF file is corrupt or cannot be read.',
    );
  });

  it('fails a data extraction error immediately with a user-safe reason', async () => {
    processing.process.mockRejectedValue(
      new DataExtractionFailedError(new Error('invalid LLM output')),
    );

    await runner.run(attempt(1));

    expect(processing.markFailed).toHaveBeenCalledWith(
      'doc-1',
      'The document data could not be extracted. Try again later.',
    );
  });
});
