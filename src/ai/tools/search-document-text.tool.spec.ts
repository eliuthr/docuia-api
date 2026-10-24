import { buildDocument } from '../../../test/support/build-document.js';
import { StorageProvider } from '../../storage/storage.provider.js';
import {
  DOCUMENT_NOT_FOUND_RESULT,
  ReadyDocumentFinder,
} from './ready-document-finder.js';
import { SearchDocumentTextTool } from './search-document-text.tool.js';

const TEXT = 'TERCERA. Plazo: tres meses a partir del 3 de noviembre de 2026.';

describe('SearchDocumentTextTool', () => {
  let findById: ReturnType<typeof vi.fn>;
  let read: ReturnType<typeof vi.fn>;
  let tool: SearchDocumentTextTool;

  beforeEach(() => {
    findById = vi.fn().mockResolvedValue(buildDocument());
    read = vi.fn().mockResolvedValue(Buffer.from(TEXT, 'utf8'));
    tool = new SearchDocumentTextTool(
      { findById } as unknown as ReadyDocumentFinder,
      { read } as unknown as StorageProvider,
    );
  });

  it('returns the passages that match the query', async () => {
    await expect(
      tool.execute({ documentId: 'doc-1', query: 'plazo' }),
    ).resolves.toEqual({ passages: [{ text: TEXT, matchedTerms: 1 }] });
    expect(read).toHaveBeenCalledWith('doc-1.txt');
  });

  it('suggests other words when nothing matches', async () => {
    await expect(
      tool.execute({ documentId: 'doc-1', query: 'garantía' }),
    ).resolves.toEqual({
      passages: [],
      note: 'No passage matched. Try other words.',
    });
  });

  it('explains that images have no searchable text', async () => {
    findById.mockResolvedValue(buildDocument({ textStorageKey: null }));

    const result = await tool.execute({ documentId: 'doc-1', query: 'total' });

    expect(result).toEqual({
      error: expect.stringContaining('get_document_details') as unknown,
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('reports a missing document', async () => {
    findById.mockResolvedValue(null);

    await expect(
      tool.execute({ documentId: 'doc-9', query: 'total' }),
    ).resolves.toBe(DOCUMENT_NOT_FOUND_RESULT);
  });

  it('rejects an empty query', () => {
    expect(
      tool.inputSchema.safeParse({ documentId: 'doc-1', query: '' }).success,
    ).toBe(false);
  });
});
