import { ToolName } from '../tools/tool-name.js';

/** Tipo de pregunta: decide qué herramientas se le ofrecen al modelo. */
export enum QuestionCategory {
  Lookup = 'lookup',
  TextSearch = 'text_search',
  Calculation = 'calculation',
  Conversational = 'conversational',
}

/**
 * Herramientas por categoría. Menos herramientas significa peticiones más
 * cortas y menos llamadas equivocadas; el modelo sigue eligiendo el orden.
 */
export const CATEGORY_TOOLS: Record<QuestionCategory, readonly ToolName[]> = {
  [QuestionCategory.Lookup]: Object.values(ToolName),
  [QuestionCategory.TextSearch]: [
    ToolName.SearchDocumentText,
    ToolName.GetDocumentDetails,
  ],
  [QuestionCategory.Calculation]: [
    ToolName.FindDocuments,
    ToolName.SumInvoiceTotals,
    ToolName.GetDocumentDetails,
  ],
  [QuestionCategory.Conversational]: [],
};

/** La categoría que se usa si la clasificación falla: tiene todas las herramientas. */
export const FALLBACK_CATEGORY = QuestionCategory.Lookup;
