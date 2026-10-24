import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
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

  createdAt: Date;
  updatedAt: Date;
}

export const DocumentRecordSchema =
  SchemaFactory.createForClass(DocumentRecord);
DocumentRecordSchema.index({ createdAt: -1 });
