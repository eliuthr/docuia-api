import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { Env } from '../../config/env.schema.js';
import { LlmInput } from '../llm/llm.provider.js';
import { truncateInput } from '../llm/truncate-input.js';
import { EXTRACT_CONTRACT_PROMPT } from '../prompts/extract-contract.prompt.js';
import { EXTRACT_INVOICE_PROMPT } from '../prompts/extract-invoice.prompt.js';
import { EXTRACT_RESUME_PROMPT } from '../prompts/extract-resume.prompt.js';
import { contractSchema } from '../schemas/contract.schema.js';
import { DocumentType } from '../schemas/document-type.js';
import { ExtractedData } from '../schemas/extracted-data.js';
import { invoiceSchema } from '../schemas/invoice.schema.js';
import { resumeSchema } from '../schemas/resume.schema.js';
import { StructuredOutputService } from './structured-output.service.js';

const EXTRACTION_MAX_OUTPUT_TOKENS = 8000;

export type ExtractableDocumentType = Exclude<DocumentType, DocumentType.Other>;

interface ExtractionSpec {
  instructions: string;
  schema: z.ZodType<ExtractedData>;
}

/** Prompt y esquema de cada tipo. Para soportar un tipo nuevo basta con agregarlo aquí. */
const EXTRACTION_SPECS: Readonly<
  Record<ExtractableDocumentType, ExtractionSpec>
> = {
  [DocumentType.Invoice]: {
    instructions: EXTRACT_INVOICE_PROMPT,
    schema: invoiceSchema,
  },
  [DocumentType.Contract]: {
    instructions: EXTRACT_CONTRACT_PROMPT,
    schema: contractSchema,
  },
  [DocumentType.Resume]: {
    instructions: EXTRACT_RESUME_PROMPT,
    schema: resumeSchema,
  },
};

@Injectable()
export class DocumentDataExtractorService {
  private readonly maxInputChars: number;

  constructor(
    private readonly structuredOutput: StructuredOutputService,
    config: ConfigService<Env, true>,
  ) {
    this.maxInputChars = config.get('LLM_MAX_INPUT_CHARS', { infer: true });
  }

  extract(
    documentId: string,
    documentType: ExtractableDocumentType,
    input: LlmInput,
  ): Promise<ExtractedData> {
    const { instructions, schema } = EXTRACTION_SPECS[documentType];
    return this.structuredOutput.generate({
      logContext: { documentId },
      instructions,
      input: truncateInput(input, this.maxInputChars),
      schemaName: documentType,
      schema,
      maxOutputTokens: EXTRACTION_MAX_OUTPUT_TOKENS,
    });
  }
}
