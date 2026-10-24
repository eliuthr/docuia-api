import { Injectable } from '@nestjs/common';
import { LlmInput } from '../llm/llm.provider.js';
import { truncateInput } from '../llm/truncate-input.js';
import { CLASSIFY_DOCUMENT_PROMPT } from '../prompts/classify-document.prompt.js';
import {
  documentClassificationSchema,
  DocumentType,
} from '../schemas/document-type.js';
import { StructuredOutputService } from './structured-output.service.js';

/** Para clasificar basta con el inicio del documento, y así se gastan menos tokens. */
const CLASSIFICATION_MAX_INPUT_CHARS = 4000;
const CLASSIFICATION_MAX_OUTPUT_TOKENS = 1000;

@Injectable()
export class DocumentClassifierService {
  constructor(private readonly structuredOutput: StructuredOutputService) {}

  async classify(documentId: string, input: LlmInput): Promise<DocumentType> {
    const { documentType } = await this.structuredOutput.generate({
      documentId,
      instructions: CLASSIFY_DOCUMENT_PROMPT,
      input: truncateInput(input, CLASSIFICATION_MAX_INPUT_CHARS),
      schemaName: 'document_classification',
      schema: documentClassificationSchema,
      maxOutputTokens: CLASSIFICATION_MAX_OUTPUT_TOKENS,
    });
    return documentType;
  }
}
