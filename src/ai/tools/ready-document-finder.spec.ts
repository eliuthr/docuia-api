import { buildDocument } from '../../../test/support/build-document.js';
import { DocumentStatus } from '../../documents/domain/document-status.enum.js';
import { DocumentRepository } from '../../documents/repositories/document.repository.js';
import { ReadyDocumentFinder } from './ready-document-finder.js';

describe('ReadyDocumentFinder', () => {
  let findById: ReturnType<typeof vi.fn>;
  let finder: ReadyDocumentFinder;

  beforeEach(() => {
    findById = vi.fn();
    finder = new ReadyDocumentFinder({
      findById,
    } as unknown as DocumentRepository);
  });

  it('returns a ready document', async () => {
    const document = buildDocument();
    findById.mockResolvedValue(document);

    await expect(finder.findById('doc-1')).resolves.toBe(document);
  });

  it.each([
    DocumentStatus.Pending,
    DocumentStatus.Processing,
    DocumentStatus.Failed,
  ])('hides a document that is %s', async (status) => {
    findById.mockResolvedValue(buildDocument({ status }));

    await expect(finder.findById('doc-1')).resolves.toBeNull();
  });

  it('returns null when the document does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(finder.findById('doc-9')).resolves.toBeNull();
  });
});
