import { ANSWER_RULES } from './answer-rules.prompt.js';

export interface QuestionDocumentContext {
  id: string;
  name: string;
  documentType: string | null;
}

/** El nombre del archivo lo eligió el usuario, así que va serializado como dato. */
export function buildDocumentQuestionPrompt(
  document: QuestionDocumentContext,
): string {
  return `You answer questions about one document in DocuIA, a document processing system.

The question is about this document: ${JSON.stringify(document)}.
Start with get_document_details for its id. Use search_document_text for details that are not
in the extracted data. You may use find_documents and sum_invoice_totals when the question also
involves other documents (for example, "other invoices from this vendor").

${ANSWER_RULES}`;
}
