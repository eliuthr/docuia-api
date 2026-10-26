import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { LlmTool } from './llm-tool.js';
import {
  DOCUMENT_NOT_FOUND_RESULT,
  ReadyDocumentFinder,
} from './ready-document-finder.js';
import { ToolName } from './tool-name.js';

const inputSchema = z.object({ documentId: z.string() });

type GetDocumentDetailsInput = z.infer<typeof inputSchema>;

@Injectable()
export class GetDocumentDetailsTool implements LlmTool<GetDocumentDetailsInput> {
  readonly name = ToolName.GetDocumentDetails;
  readonly description =
    'Returns the type, summary and all the structured data extracted from one document ' +
    '(for example an invoice with vendor, dates, line items and totals). ' +
    'Use it first when a question is about a specific document.';
  readonly inputSchema = inputSchema;

  constructor(private readonly documents: ReadyDocumentFinder) {}

  async execute({ documentId }: GetDocumentDetailsInput): Promise<unknown> {
    const document = await this.documents.findById(documentId);
    if (!document) {
      return DOCUMENT_NOT_FOUND_RESULT;
    }
    return {
      id: document.id,
      name: document.originalName,
      documentType: document.documentType,
      pageCount: document.pageCount,
      summary: document.summary,
      extractedData: document.extractedData,
    };
  }
}
