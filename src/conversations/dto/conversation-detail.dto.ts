import { ApiProperty } from '@nestjs/swagger';
import type { ConversationWithMessages } from '../conversations.service.js';
import {
  CONVERSATION_ROLES,
  type ConversationMessage,
  type ConversationRole,
} from '../domain/conversation.entity.js';
import {
  ConversationSummaryDto,
  toSummaryFields,
} from './conversation-summary.dto.js';

export class ConversationMessageDto {
  @ApiProperty({ enum: CONVERSATION_ROLES, example: 'user' })
  role: ConversationRole;

  @ApiProperty({ example: '¿Cuánto suman las facturas de Tecnosuministros?' })
  text: string;

  @ApiProperty()
  createdAt: Date;

  static fromMessage(message: ConversationMessage): ConversationMessageDto {
    return {
      role: message.role,
      text: message.text,
      createdAt: message.createdAt,
    };
  }
}

export class ConversationDetailDto extends ConversationSummaryDto {
  @ApiProperty({
    type: [ConversationMessageDto],
    description: 'Questions and final answers, oldest first',
  })
  messages: ConversationMessageDto[];

  static fromConversation({
    conversation,
    messages,
  }: ConversationWithMessages): ConversationDetailDto {
    return {
      ...toSummaryFields(conversation),
      messages: messages.map((message) =>
        ConversationMessageDto.fromMessage(message),
      ),
    };
  }
}
