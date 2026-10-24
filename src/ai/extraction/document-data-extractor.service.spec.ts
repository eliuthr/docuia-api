import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema.js';
import { EXTRACT_CONTRACT_PROMPT } from '../prompts/extract-contract.prompt.js';
import { EXTRACT_INVOICE_PROMPT } from '../prompts/extract-invoice.prompt.js';
import { EXTRACT_RESUME_PROMPT } from '../prompts/extract-resume.prompt.js';
import { contractSchema } from '../schemas/contract.schema.js';
import { DocumentType } from '../schemas/document-type.js';
import { invoiceSchema } from '../schemas/invoice.schema.js';
import { resumeSchema } from '../schemas/resume.schema.js';
import {
  DocumentDataExtractorService,
  ExtractableDocumentType,
} from './document-data-extractor.service.js';
import { StructuredOutputService } from './structured-output.service.js';

const MAX_INPUT_CHARS = 1000;

describe('DocumentDataExtractorService', () => {
  let generate: ReturnType<typeof vi.fn>;
  let extractor: DocumentDataExtractorService;

  beforeEach(() => {
    generate = vi.fn().mockResolvedValue({ total: 150 });
    const config = {
      get: vi.fn().mockReturnValue(MAX_INPUT_CHARS),
    } as unknown as ConfigService<Env, true>;
    extractor = new DocumentDataExtractorService(
      { generate } as unknown as StructuredOutputService,
      config,
    );
  });

  it.each<[ExtractableDocumentType, string, unknown]>([
    [DocumentType.Invoice, EXTRACT_INVOICE_PROMPT, invoiceSchema],
    [DocumentType.Contract, EXTRACT_CONTRACT_PROMPT, contractSchema],
    [DocumentType.Resume, EXTRACT_RESUME_PROMPT, resumeSchema],
  ])('uses the %s prompt and schema', async (documentType, prompt, schema) => {
    await extractor.extract('doc-1', documentType, {
      kind: 'text',
      text: 'content',
    });

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: prompt,
        schema,
        schemaName: documentType,
      }),
    );
  });

  it('returns the validated data', async () => {
    await expect(
      extractor.extract('doc-1', DocumentType.Invoice, {
        kind: 'text',
        text: 'Total 150',
      }),
    ).resolves.toEqual({ total: 150 });
  });

  it('truncates text to LLM_MAX_INPUT_CHARS', async () => {
    await extractor.extract('doc-1', DocumentType.Invoice, {
      kind: 'text',
      text: 'x'.repeat(5000),
    });

    const [request] = generate.mock.calls[0] as [{ input: { text: string } }];
    expect(request.input.text).toHaveLength(MAX_INPUT_CHARS);
  });
});
