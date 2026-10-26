import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AskQuestionDto } from './dto/ask-question.dto.js';
import { QuestionAnsweringService } from './question-answering.service.js';
import { abortOnClientDisconnect, writeSse } from './sse-writer.js';

const SSE_RESPONSE_DESCRIPTION =
  'Server-Sent Events stream. Events: `conversation` ({ id }) first, with the id to send ' +
  'as `conversationId` in follow-up questions; `status` ({ step }) when the agent starts ' +
  'classifying, answering, verifying or revising; `tool` ({ name }) when a tool is used, ' +
  '`delta` ({ text }) with a piece of the answer, `done` ({}) at the end, and ' +
  '`error` ({ message }) if the answer fails after streaming started.';

@ApiTags('questions')
@Controller()
export class QuestionsController {
  constructor(private readonly questions: QuestionAnsweringService) {}

  @Post('documents/:id/ask')
  @ApiOperation({ summary: 'Ask a question about one document (streamed)' })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({ description: SSE_RESPONSE_DESCRIPTION })
  @ApiBadRequestResponse({
    description:
      'Invalid id, question or conversationId, or the conversation belongs to another document',
  })
  @ApiNotFoundResponse({ description: 'Document or conversation not found' })
  @ApiConflictResponse({
    description: 'The document is not ready yet, or the conversation is full',
  })
  async askAboutDocument(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: AskQuestionDto,
    @Res() response: Response,
  ): Promise<void> {
    const signal = abortOnClientDisconnect(response);
    const events = await this.questions.answerAboutDocument(id, body, signal);
    await writeSse(response, events, signal);
  }

  @Post('ask')
  @ApiOperation({
    summary: 'Ask a question about all processed documents (streamed)',
  })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({ description: SSE_RESPONSE_DESCRIPTION })
  @ApiBadRequestResponse({
    description:
      'Invalid question or conversationId, or the conversation belongs to a document',
  })
  @ApiNotFoundResponse({ description: 'Conversation not found' })
  @ApiConflictResponse({ description: 'The conversation is full' })
  async askAboutCollection(
    @Body() body: AskQuestionDto,
    @Res() response: Response,
  ): Promise<void> {
    const signal = abortOnClientDisconnect(response);
    const events = await this.questions.answerAboutCollection(body, signal);
    await writeSse(response, events, signal);
  }
}
