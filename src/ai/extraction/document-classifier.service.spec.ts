import { CLASSIFY_DOCUMENT_PROMPT } from '../prompts/classify-document.prompt.js';
import {
  documentClassificationSchema,
  DocumentType,
} from '../schemas/document-type.js';
import { DocumentClassifierService } from './document-classifier.service.js';
import { StructuredOutputService } from './structured-output.service.js';

describe('DocumentClassifierService', () => {
  let generate: ReturnType<typeof vi.fn>;
  let classifier: DocumentClassifierService;

  beforeEach(() => {
    generate = vi
      .fn()
      .mockResolvedValue({ documentType: DocumentType.Invoice });
    classifier = new DocumentClassifierService({
      generate,
    } as unknown as StructuredOutputService);
  });

  it('returns the type chosen by the model', async () => {
    await expect(
      classifier.classify('doc-1', { kind: 'text', text: 'Factura' }),
    ).resolves.toBe(DocumentType.Invoice);
  });

  it('uses the classification prompt and schema', async () => {
    await classifier.classify('doc-1', { kind: 'text', text: 'Factura' });

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
        instructions: CLASSIFY_DOCUMENT_PROMPT,
        schema: documentClassificationSchema,
      }),
    );
  });

  it('sends only the beginning of long documents', async () => {
    await classifier.classify('doc-1', {
      kind: 'text',
      text: 'x'.repeat(10_000),
    });

    const [request] = generate.mock.calls[0] as [{ input: { text: string } }];
    expect(request.input.text).toHaveLength(4000);
  });
});
