import { Module } from '@nestjs/common';
import { DocumentPersistenceModule } from '../../documents/repositories/document-persistence.module.js';
import { LlmModule } from '../llm/llm.module.js';
import { ToolsModule } from '../tools/tools.module.js';
import { QuestionAnsweringService } from './question-answering.service.js';
import { QuestionsController } from './questions.controller.js';
import { ToolLoopService } from './tool-loop.service.js';

/** Preguntas sobre documentos con tool calling y streaming; solo lo carga la API. */
@Module({
  imports: [LlmModule, ToolsModule, DocumentPersistenceModule],
  controllers: [QuestionsController],
  providers: [ToolLoopService, QuestionAnsweringService],
})
export class QuestionsModule {}
