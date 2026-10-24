import { ApiProperty } from '@nestjs/swagger';
import { DocumentStatus } from '../domain/document-status.enum.js';
import { DocumentEntity } from '../domain/document.entity.js';

export class DocumentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'invoice-001.pdf' })
  originalName: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType: string;

  @ApiProperty({ example: 48213 })
  sizeBytes: number;

  @ApiProperty({ enum: DocumentStatus, example: DocumentStatus.Pending })
  status: DocumentStatus;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 2,
    description: 'Number of pages; null for images or until processed',
  })
  pageCount: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'Why processing failed; set only when status is failed',
  })
  failureReason: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: DocumentEntity): DocumentResponseDto {
    return {
      id: entity.id,
      originalName: entity.originalName,
      mimeType: entity.mimeType,
      sizeBytes: entity.sizeBytes,
      status: entity.status,
      pageCount: entity.pageCount,
      failureReason: entity.failureReason,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
