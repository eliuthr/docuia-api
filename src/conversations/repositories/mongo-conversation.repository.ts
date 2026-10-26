import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ConversationScope,
  scopeDocumentId,
  scopeFromDocumentId,
} from '../domain/conversation-scope.js';
import {
  ConversationEntity,
  ConversationMessage,
  NewConversation,
} from '../domain/conversation.entity.js';
import { ConversationMessageRecord } from '../schemas/conversation-message-record.schema.js';
import { ConversationRecord } from '../schemas/conversation-record.schema.js';
import { ConversationRepository } from './conversation.repository.js';

// Si dos mensajes tienen la misma fecha, el _id (ObjectId) conserva el orden de inserción.
const OLDEST_FIRST = { createdAt: 1, _id: 1 } as const;
const NEWEST_FIRST = { createdAt: -1, _id: -1 } as const;

@Injectable()
export class MongoConversationRepository extends ConversationRepository {
  constructor(
    @InjectModel(ConversationRecord.name)
    private readonly conversations: Model<ConversationRecord>,
    @InjectModel(ConversationMessageRecord.name)
    private readonly messages: Model<ConversationMessageRecord>,
  ) {
    super();
  }

  async create(conversation: NewConversation): Promise<ConversationEntity> {
    const created = await this.conversations.create({
      _id: conversation.id,
      documentId: scopeDocumentId(conversation.scope),
      title: conversation.title,
      messageCount: 0,
    });
    return toEntity(created.toObject());
  }

  async findById(id: string): Promise<ConversationEntity | null> {
    const record = await this.conversations
      .findById(id)
      .lean<ConversationRecord>()
      .exec();
    return record ? toEntity(record) : null;
  }

  async listByScope(
    scope: ConversationScope,
    limit: number,
  ): Promise<ConversationEntity[]> {
    const records = await this.conversations
      .find({ documentId: scopeDocumentId(scope), messageCount: { $gt: 0 } })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean<ConversationRecord[]>()
      .exec();
    return records.map(toEntity);
  }

  async findRecentMessages(
    id: string,
    limit: number,
  ): Promise<ConversationMessage[]> {
    const records = await this.messages
      .find({ conversationId: id })
      .sort(NEWEST_FIRST)
      .limit(limit)
      .lean<ConversationMessageRecord[]>()
      .exec();
    return records.reverse().map(toMessage);
  }

  async findAllMessages(id: string): Promise<ConversationMessage[]> {
    const records = await this.messages
      .find({ conversationId: id })
      .sort(OLDEST_FIRST)
      .lean<ConversationMessageRecord[]>()
      .exec();
    return records.map(toMessage);
  }

  async appendMessages(
    id: string,
    messages: ConversationMessage[],
  ): Promise<void> {
    await this.messages.insertMany(
      messages.map((message) => ({ conversationId: id, ...message })),
    );
    await this.conversations
      .updateOne({ _id: id }, { $inc: { messageCount: messages.length } })
      .exec();
  }
}

function toEntity(record: ConversationRecord): ConversationEntity {
  const { _id, documentId, ...fields } = record;
  return { id: _id, scope: scopeFromDocumentId(documentId), ...fields };
}

function toMessage(record: ConversationMessageRecord): ConversationMessage {
  return { role: record.role, text: record.text, createdAt: record.createdAt };
}
