import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '../../ai/schemas/document-type.js';
import { ExtractedData } from '../../ai/schemas/extracted-data.js';
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

  @ApiProperty({
    enum: DocumentType,
    nullable: true,
    example: DocumentType.Invoice,
    description: 'Type detected by the LLM; null until processed',
  })
  documentType: DocumentType | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example:
      'Factura de Papelería El Centro por 119.000 COP con fecha 1 de octubre de 2026.',
    description: 'Short summary written by the LLM; null until processed',
  })
  summary: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: {
      vendorName: 'Papelería El Centro',
      invoiceNumber: 'FE-1024',
      issueDate: '2026-10-01',
      currency: 'COP',
      total: 119000,
    },
    description:
      'Data extracted by the LLM. Its shape depends on documentType ' +
      '(invoice, contract or resume); missing fields are null. ' +
      'Null for "other" documents or until processed.',
  })
  extractedData: ExtractedData | null;

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
      documentType: entity.documentType,
      summary: entity.summary,
      extractedData: entity.extractedData,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
