import { ApiProperty } from '@nestjs/swagger';
import { ListedDocuments } from '../documents.service.js';
import { DocumentResponseDto } from './document-response.dto.js';

export class DocumentPageResponseDto {
  @ApiProperty({ type: [DocumentResponseDto] })
  items: DocumentResponseDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Opaque cursor for the next page (pass it as `cursor`); null on the last page',
  })
  nextCursor: string | null;

  static fromListed(listed: ListedDocuments): DocumentPageResponseDto {
    return {
      items: listed.documents.map((document) =>
        DocumentResponseDto.fromEntity(document),
      ),
      nextCursor: listed.nextCursor,
    };
  }
}
