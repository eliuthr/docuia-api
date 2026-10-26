import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema.js';
import { DOCUMENT_OVERVIEW_PROMPT } from '../prompts/document-overview.prompt.js';
import { documentOverviewSchema } from '../schemas/document-overview.schema.js';
import { DocumentType } from '../schemas/document-type.js';
import { DocumentOverviewService } from './document-overview.service.js';
import { StructuredOutputService } from './structured-output.service.js';

const MAX_INPUT_CHARS = 1000;
const OVERVIEW = { documentType: DocumentType.Invoice, summary: 'Factura.' };

describe('DocumentOverviewService', () => {
  let generate: ReturnType<typeof vi.fn>;
  let service: DocumentOverviewService;

  beforeEach(() => {
    generate = vi.fn().mockResolvedValue(OVERVIEW);
    const config = {
      get: vi.fn().mockReturnValue(MAX_INPUT_CHARS),
    } as unknown as ConfigService<Env, true>;
    service = new DocumentOverviewService(
      { generate } as unknown as StructuredOutputService,
      config,
    );
  });

  it('returns the type and summary chosen by the model', async () => {
    await expect(
      service.describe('doc-1', { kind: 'text', text: 'Factura' }),
    ).resolves.toEqual(OVERVIEW);
  });

  it('uses the overview prompt and schema', async () => {
    await service.describe('doc-1', { kind: 'text', text: 'Factura' });

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        logContext: { documentId: 'doc-1' },
        instructions: DOCUMENT_OVERVIEW_PROMPT,
        schema: documentOverviewSchema,
      }),
    );
  });

  it('truncates text to LLM_MAX_INPUT_CHARS', async () => {
    await service.describe('doc-1', { kind: 'text', text: 'x'.repeat(5000) });

    const [request] = generate.mock.calls[0] as [{ input: { text: string } }];
    expect(request.input.text).toHaveLength(MAX_INPUT_CHARS);
  });
});
