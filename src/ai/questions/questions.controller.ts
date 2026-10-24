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
  'Server-Sent Events stream. Events: `tool` ({ name }) when a tool is used, ' +
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
  @ApiBadRequestResponse({ description: 'Invalid id or question' })
  @ApiNotFoundResponse({ description: 'Document not found' })
  @ApiConflictResponse({ description: 'The document is not ready yet' })
  async askAboutDocument(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: AskQuestionDto,
    @Res() response: Response,
  ): Promise<void> {
    const signal = abortOnClientDisconnect(response);
    const events = await this.questions.answerAboutDocument(
      id,
      body.question,
      signal,
    );
    await writeSse(response, events, signal);
  }

  @Post('ask')
  @ApiOperation({
    summary: 'Ask a question about all processed documents (streamed)',
  })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({ description: SSE_RESPONSE_DESCRIPTION })
  @ApiBadRequestResponse({ description: 'Invalid question' })
  async askAboutCollection(
    @Body() body: AskQuestionDto,
    @Res() response: Response,
  ): Promise<void> {
    const signal = abortOnClientDisconnect(response);
    const events = this.questions.answerAboutCollection(body.question, signal);
    await writeSse(response, events, signal);
  }
}
