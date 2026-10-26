import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListConversationsQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Conversations about this document; omit it for conversations about the whole collection',
  })
  @IsOptional()
  @IsUUID('4')
  documentId?: string;
}
