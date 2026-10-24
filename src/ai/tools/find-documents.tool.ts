import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DocumentStatus } from '../../documents/domain/document-status.enum.js';
import { DocumentRepository } from '../../documents/repositories/document.repository.js';
import { DocumentType } from '../schemas/document-type.js';
import { keyFieldsOf } from './document-key-fields.js';
import { LlmTool } from './llm-tool.js';

const MAX_RESULTS = 20;

const inputSchema = z.object({
  documentType: z.enum(DocumentType).nullable(),
  text: z.string().min(1).nullable(),
  limit: z.int().min(1).max(MAX_RESULTS),
});

type FindDocumentsInput = z.infer<typeof inputSchema>;

@Injectable()
export class FindDocumentsTool implements LlmTool<FindDocumentsInput> {
  readonly name = 'find_documents';
  readonly description =
    'Lists processed documents, newest first, with their summary and key fields ' +
    '(vendor and total for invoices, parties and value for contracts, name for résumés). ' +
    'Filter by documentType and/or by text, which matches file names, summaries and the ' +
    'names of vendors, customers, contract parties and candidates (case-insensitive, ' +
    'partial words allowed). Use null to skip a filter.';
  readonly inputSchema = inputSchema;

  constructor(private readonly repository: DocumentRepository) {}

  async execute(input: FindDocumentsInput): Promise<unknown> {
    const documents = await this.repository.search({
      status: DocumentStatus.Ready,
      documentType: input.documentType,
      text: input.text,
      limit: input.limit,
    });
    return {
      count: documents.length,
      documents: documents.map((document) => ({
        id: document.id,
        name: document.originalName,
        documentType: document.documentType,
        uploadedAt: document.createdAt,
        summary: document.summary,
        keyFields: keyFieldsOf(document),
      })),
    };
  }
}
