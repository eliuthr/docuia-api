import { Module } from '@nestjs/common';
import { DocumentPersistenceModule } from '../../documents/repositories/document-persistence.module.js';
import { StorageModule } from '../../storage/storage.module.js';
import { FindDocumentsTool } from './find-documents.tool.js';
import { GetDocumentDetailsTool } from './get-document-details.tool.js';
import { LLM_TOOLS, LlmTool } from './llm-tool.js';
import { ReadyDocumentFinder } from './ready-document-finder.js';
import { SearchDocumentTextTool } from './search-document-text.tool.js';
import { SumInvoiceTotalsTool } from './sum-invoice-totals.tool.js';
import { ToolRegistry } from './tool-registry.js';

/** Para agregar una herramienta: crearla en esta carpeta y sumarla a TOOLS. */
const TOOLS = [
  GetDocumentDetailsTool,
  SearchDocumentTextTool,
  FindDocumentsTool,
  SumInvoiceTotalsTool,
];

@Module({
  imports: [DocumentPersistenceModule, StorageModule],
  providers: [
    ReadyDocumentFinder,
    ...TOOLS,
    {
      provide: LLM_TOOLS,
      inject: TOOLS,
      useFactory: (...tools: LlmTool[]) => tools,
    },
    ToolRegistry,
  ],
  exports: [ToolRegistry],
})
export class ToolsModule {}
