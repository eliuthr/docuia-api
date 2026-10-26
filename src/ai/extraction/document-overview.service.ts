import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema.js';
import { LlmInput } from '../llm/llm.provider.js';
import { truncateInput } from '../llm/truncate-input.js';
import { DOCUMENT_OVERVIEW_PROMPT } from '../prompts/document-overview.prompt.js';
import {
  DocumentOverview,
  documentOverviewSchema,
} from '../schemas/document-overview.schema.js';
import { StructuredOutputService } from './structured-output.service.js';

const OVERVIEW_MAX_OUTPUT_TOKENS = 1000;

/** Clasifica el documento y lo resume en la misma llamada (ver spec 004). */
@Injectable()
export class DocumentOverviewService {
  private readonly maxInputChars: number;

  constructor(
    private readonly structuredOutput: StructuredOutputService,
    config: ConfigService<Env, true>,
  ) {
    this.maxInputChars = config.get('LLM_MAX_INPUT_CHARS', { infer: true });
  }

  describe(documentId: string, input: LlmInput): Promise<DocumentOverview> {
    return this.structuredOutput.generate({
      logContext: { documentId },
      instructions: DOCUMENT_OVERVIEW_PROMPT,
      input: truncateInput(input, this.maxInputChars),
      schemaName: 'document_overview',
      schema: documentOverviewSchema,
      maxOutputTokens: OVERVIEW_MAX_OUTPUT_TOKENS,
    });
  }
}
