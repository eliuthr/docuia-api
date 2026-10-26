import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  QueryCommandInput,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema.js';
import { requireConfig } from '../../config/require-config.js';
import { ConversationScope } from '../domain/conversation-scope.js';
import {
  ConversationEntity,
  ConversationMessage,
  NewConversation,
} from '../domain/conversation.entity.js';
import { ConversationRepository } from './conversation.repository.js';
import {
  CONVERSATIONS_BY_SCOPE_INDEX,
  ConversationItem,
  MessageItem,
  scopeKeyOf,
  toConversationEntity,
  toConversationItem,
  toConversationMessage,
  toMessageItem,
} from './dynamodb-conversation.mapper.js';

/** Conversaciones que la lista revisa como máximo para saltar las que no tienen mensajes. */
const LIST_SCAN_LIMIT = 100;

type StartKey = Record<string, unknown> | undefined;

@Injectable()
export class DynamoDbConversationRepository extends ConversationRepository {
  private readonly conversationsTable: string;
  private readonly messagesTable: string;

  constructor(
    private readonly client: DynamoDBDocumentClient,
    config: ConfigService<Env, true>,
  ) {
    super();
    this.conversationsTable = requireConfig(
      config,
      'DYNAMODB_CONVERSATIONS_TABLE',
    );
    this.messagesTable = requireConfig(config, 'DYNAMODB_MESSAGES_TABLE');
  }

  async create(conversation: NewConversation): Promise<ConversationEntity> {
    const now = new Date();
    const entity = {
      ...conversation,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await this.client.send(
      new PutCommand({
        TableName: this.conversationsTable,
        Item: toConversationItem(entity),
        ConditionExpression: 'attribute_not_exists(id)',
      }),
    );
    return entity;
  }

  async findById(id: string): Promise<ConversationEntity | null> {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.conversationsTable, Key: { id } }),
    );
    return Item ? toConversationEntity(Item as ConversationItem) : null;
  }

  async listByScope(
    scope: ConversationScope,
    limit: number,
  ): Promise<ConversationEntity[]> {
    const found: ConversationEntity[] = [];
    let startKey: StartKey;
    let scanned = 0;
    do {
      const page = await this.queryPage<ConversationItem>({
        TableName: this.conversationsTable,
        IndexName: CONVERSATIONS_BY_SCOPE_INDEX,
        KeyConditionExpression: 'scopeKey = :scopeKey',
        ExpressionAttributeValues: { ':scopeKey': scopeKeyOf(scope) },
        ScanIndexForward: false,
        Limit: limit,
        ExclusiveStartKey: startKey,
      });
      scanned += page.items.length;
      found.push(
        ...page.items
          .filter((item) => item.messageCount > 0)
          .map(toConversationEntity),
      );
      startKey = page.nextKey;
    } while (startKey && found.length < limit && scanned < LIST_SCAN_LIMIT);
    return found.slice(0, limit);
  }

  async findRecentMessages(
    id: string,
    limit: number,
  ): Promise<ConversationMessage[]> {
    const { items } = await this.queryPage<MessageItem>({
      ...this.messagesOf(id),
      ScanIndexForward: false,
      Limit: limit,
    });
    return items.reverse().map(toConversationMessage);
  }

  async findAllMessages(id: string): Promise<ConversationMessage[]> {
    const messages: ConversationMessage[] = [];
    let startKey: StartKey;
    do {
      const page = await this.queryPage<MessageItem>({
        ...this.messagesOf(id),
        ExclusiveStartKey: startKey,
      });
      messages.push(...page.items.map(toConversationMessage));
      startKey = page.nextKey;
    } while (startKey);
    return messages;
  }

  /**
   * Guarda los mensajes y suma el contador en una sola transacción. La
   * condición sobre `messageCount` evita que dos escrituras simultáneas usen
   * los mismos números de secuencia.
   */
  async appendMessages(
    id: string,
    messages: ConversationMessage[],
  ): Promise<void> {
    const conversation = await this.findById(id);
    if (!conversation) {
      return;
    }
    const firstSequence = conversation.messageCount;
    await this.client.send(
      new TransactWriteCommand({
        TransactItems: [
          ...messages.map((message, index) => ({
            Put: {
              TableName: this.messagesTable,
              Item: toMessageItem(id, firstSequence + index, message),
            },
          })),
          {
            Update: {
              TableName: this.conversationsTable,
              Key: { id },
              UpdateExpression:
                'SET messageCount = :newCount, updatedAt = :updatedAt',
              ConditionExpression: 'messageCount = :currentCount',
              ExpressionAttributeValues: {
                ':currentCount': firstSequence,
                ':newCount': firstSequence + messages.length,
                ':updatedAt': new Date().toISOString(),
              },
            },
          },
        ],
      }),
    );
  }

  /** Mensajes de una conversación, del más antiguo al más reciente (por secuencia). */
  private messagesOf(id: string): QueryCommandInput {
    return {
      TableName: this.messagesTable,
      KeyConditionExpression: 'conversationId = :conversationId',
      ExpressionAttributeValues: { ':conversationId': id },
    };
  }

  private async queryPage<Item>(
    input: QueryCommandInput,
  ): Promise<{ items: Item[]; nextKey: StartKey }> {
    const { Items = [], LastEvaluatedKey } = await this.client.send(
      new QueryCommand(input),
    );
    return { items: Items as Item[], nextKey: LastEvaluatedKey };
  }
}
