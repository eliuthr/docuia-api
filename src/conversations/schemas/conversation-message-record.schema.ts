import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  CONVERSATION_ROLES,
  type ConversationRole,
} from '../domain/conversation.entity.js';

/** Un mensaje por registro, igual que un ítem por mensaje en DynamoDB. */
@Schema({ collection: 'conversation_messages', versionKey: false })
export class ConversationMessageRecord {
  @Prop({ required: true })
  conversationId: string;

  @Prop({ type: String, enum: CONVERSATION_ROLES, required: true })
  role: ConversationRole;

  @Prop({ required: true })
  text: string;

  @Prop({ required: true })
  createdAt: Date;
}

export const ConversationMessageRecordSchema = SchemaFactory.createForClass(
  ConversationMessageRecord,
);
ConversationMessageRecordSchema.index({ conversationId: 1, createdAt: 1 });
