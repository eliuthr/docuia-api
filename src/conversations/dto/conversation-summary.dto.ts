import { ApiProperty } from '@nestjs/swagger';
import { scopeDocumentId } from '../domain/conversation-scope.js';
import { ConversationEntity } from '../domain/conversation.entity.js';

export class ConversationSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'The document the conversation is about; null for the whole collection',
  })
  documentId: string | null;

  @ApiProperty({
    example: '¿Cuánto suman las facturas de Tecnosuministros?',
    description: 'The first question, cut to 80 characters',
  })
  title: string;

  @ApiProperty({ example: 4 })
  messageCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: ConversationEntity): ConversationSummaryDto {
    return toSummaryFields(entity);
  }
}

/** Objeto plano (no instancia de clase) para poder combinarlo con spread en otros DTOs. */
export function toSummaryFields(
  entity: ConversationEntity,
): Pick<ConversationSummaryDto, keyof ConversationSummaryDto> {
  return {
    id: entity.id,
    documentId: scopeDocumentId(entity.scope),
    title: entity.title,
    messageCount: entity.messageCount,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
