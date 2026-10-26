import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ collection: 'conversations', timestamps: true, versionKey: false })
export class ConversationRecord {
  @Prop({ type: String, required: true })
  _id: string;

  /** Id del documento, o null si la conversación es sobre toda la colección. */
  @Prop({ type: String, default: null })
  documentId: string | null;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true, default: 0 })
  messageCount: number;

  createdAt: Date;
  updatedAt: Date;
}

export const ConversationRecordSchema =
  SchemaFactory.createForClass(ConversationRecord);
// Coincide con la consulta de la lista: por alcance, de la más reciente a la más antigua.
ConversationRecordSchema.index({ documentId: 1, updatedAt: -1 });
