import { DataExtractionFailedError } from './data-extraction-failed.error.js';
import {
  failureReasonFor,
  GENERIC_FAILURE_REASON,
} from './permanent-processing.error.js';
import { UnreadableDocumentError } from './unreadable-document.error.js';

describe('failureReasonFor', () => {
  it('uses the message of a permanent error', () => {
    expect(failureReasonFor(new UnreadableDocumentError('Corrupt PDF.'))).toBe(
      'Corrupt PDF.',
    );
  });

  it('hides the internal cause of a data extraction failure', () => {
    const error = new DataExtractionFailedError(new Error('schema "invoice"'));

    expect(failureReasonFor(error)).toBe(
      'The document data could not be extracted. Try again later.',
    );
  });

  it('uses the generic reason for any other error', () => {
    expect(failureReasonFor(new Error('ENOENT: /uploads/doc-1.pdf'))).toBe(
      GENERIC_FAILURE_REASON,
    );
  });
});
