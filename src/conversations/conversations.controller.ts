import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ConversationsService } from './conversations.service.js';
import {
  COLLECTION_SCOPE,
  documentScope,
} from './domain/conversation-scope.js';
import { ConversationDetailDto } from './dto/conversation-detail.dto.js';
import { ConversationSummaryDto } from './dto/conversation-summary.dto.js';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto.js';

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List the most recent conversations about a document or about the collection',
  })
  @ApiOkResponse({ type: [ConversationSummaryDto] })
  @ApiBadRequestResponse({ description: 'Invalid document id' })
  async list(
    @Query() query: ListConversationsQueryDto,
  ): Promise<ConversationSummaryDto[]> {
    const scope = query.documentId
      ? documentScope(query.documentId)
      : COLLECTION_SCOPE;
    const conversations = await this.conversations.list(scope);
    return conversations.map((conversation) =>
      ConversationSummaryDto.fromEntity(conversation),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation with all its messages' })
  @ApiOkResponse({ type: ConversationDetailDto })
  @ApiBadRequestResponse({ description: 'Invalid id' })
  @ApiNotFoundResponse({ description: 'Conversation not found' })
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ConversationDetailDto> {
    const conversation = await this.conversations.findWithMessages(id);
    return ConversationDetailDto.fromConversation(conversation);
  }
}
