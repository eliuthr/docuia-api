import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { StorageProvider } from '../../storage/storage.provider.js';
import { searchPassages } from './keyword-search.js';
import { LlmTool } from './llm-tool.js';
import {
  DOCUMENT_NOT_FOUND_RESULT,
  ReadyDocumentFinder,
} from './ready-document-finder.js';
import { ToolName } from './tool-name.js';

const MAX_PASSAGES = 5;

const inputSchema = z.object({
  documentId: z.string(),
  query: z.string().min(1),
});

type SearchDocumentTextInput = z.infer<typeof inputSchema>;

@Injectable()
export class SearchDocumentTextTool implements LlmTool<SearchDocumentTextInput> {
  readonly name = ToolName.SearchDocumentText;
  readonly description =
    'Searches the full text of one document by keywords and returns the passages that ' +
    'match the most words. Use it for details that are not in the extracted data, such as ' +
    'contract clauses. Use specific words from the document language; if nothing matches, ' +
    'try synonyms.';
  readonly inputSchema = inputSchema;

  constructor(
    private readonly documents: ReadyDocumentFinder,
    private readonly storage: StorageProvider,
  ) {}

  async execute({
    documentId,
    query,
  }: SearchDocumentTextInput): Promise<unknown> {
    const document = await this.documents.findById(documentId);
    if (!document) {
      return DOCUMENT_NOT_FOUND_RESULT;
    }
    if (!document.textStorageKey) {
      return {
        error:
          'This document has no searchable text (it is an image or a scanned PDF). ' +
          'Use get_document_details instead.',
      };
    }

    const text = (await this.storage.read(document.textStorageKey)).toString(
      'utf8',
    );
    const passages = searchPassages(text, query, MAX_PASSAGES);
    return passages.length > 0
      ? { passages }
      : { passages, note: 'No passage matched. Try other words.' };
  }
}
