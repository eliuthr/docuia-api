import { Module } from '@nestjs/common';
import { ConversationsModule } from '../../conversations/conversations.module.js';
import { DocumentPersistenceModule } from '../../documents/repositories/document-persistence.module.js';
import { CallModelNode } from '../agent/nodes/call-model.node.js';
import { ClassifyQuestionNode } from '../agent/nodes/classify-question.node.js';
import { EmitAnswerNode } from '../agent/nodes/emit-answer.node.js';
import { RespondNode } from '../agent/nodes/respond.node.js';
import { ReviseAnswerNode } from '../agent/nodes/revise-answer.node.js';
import { RunToolsNode } from '../agent/nodes/run-tools.node.js';
import { VerifyAnswerNode } from '../agent/nodes/verify-answer.node.js';
import { QuestionAgentService } from '../agent/question-agent.service.js';
import { QuestionGraphFactory } from '../agent/question-graph.factory.js';
import { StructuredOutputService } from '../extraction/structured-output.service.js';
import { LlmModule } from '../llm/llm.module.js';
import { ToolsModule } from '../tools/tools.module.js';
import { ConversationAnswerService } from './conversation-answer.service.js';
import { QuestionAnsweringService } from './question-answering.service.js';
import { QuestionsController } from './questions.controller.js';

const AGENT_NODES = [
  ClassifyQuestionNode,
  RespondNode,
  CallModelNode,
  RunToolsNode,
  VerifyAnswerNode,
  ReviseAnswerNode,
  EmitAnswerNode,
];

/** Preguntas sobre documentos con el agente de LangGraph y streaming; solo lo carga la API. */
@Module({
  imports: [
    LlmModule,
    ToolsModule,
    DocumentPersistenceModule,
    ConversationsModule,
  ],
  controllers: [QuestionsController],
  providers: [
    StructuredOutputService,
    ...AGENT_NODES,
    QuestionGraphFactory,
    QuestionAgentService,
    ConversationAnswerService,
    QuestionAnsweringService,
  ],
})
export class QuestionsModule {}
