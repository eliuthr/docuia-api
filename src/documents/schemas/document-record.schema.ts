import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DocumentType } from '../../ai/schemas/document-type.js';
import { ExtractedData } from '../../ai/schemas/extracted-data.js';
import { DocumentStatus } from '../domain/document-status.enum.js';

@Schema({ collection: 'documents', timestamps: true, versionKey: false })
export class DocumentRecord {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  sizeBytes: number;

  @Prop({ required: true })
  storageKey: string;

  @Prop({ type: String, enum: DocumentStatus, required: true })
  status: DocumentStatus;

  @Prop({ type: String, default: null })
  textStorageKey?: string | null;

  @Prop({ type: Number, default: null })
  pageCount?: number | null;

  @Prop({ type: String, default: null })
  failureReason?: string | null;

  @Prop({ type: String, enum: DocumentType, default: null })
  documentType?: DocumentType | null;

  @Prop({ type: String, default: null })
  summary?: string | null;

  // Mixed: la forma depende del tipo de documento y ya viene validada con Zod.
  @Prop({ type: Object, default: null })
  extractedData?: ExtractedData | null;

  createdAt: Date;
  updatedAt: Date;
}

export const DocumentRecordSchema =
  SchemaFactory.createForClass(DocumentRecord);
DocumentRecordSchema.index({ createdAt: -1 });
