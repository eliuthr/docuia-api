import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';
import { mockClient } from 'aws-sdk-client-mock';
import { Env } from '../../config/env.schema.js';
import {
  COLLECTION_SCOPE,
  documentScope,
} from '../domain/conversation-scope.js';
import { ConversationEntity } from '../domain/conversation.entity.js';
import {
  toConversationItem,
  toMessageItem,
} from './dynamodb-conversation.mapper.js';
import { DynamoDbConversationRepository } from './dynamodb-conversation.repository.js';

const TABLES: Partial<Env> = {
  DYNAMODB_CONVERSATIONS_TABLE: 'docuia-conversations',
  DYNAMODB_MESSAGES_TABLE: 'docuia-messages',
};
const NOW = new Date('2026-10-26T15:00:00.000Z');

function buildConversation(
  overrides: Partial<ConversationEntity> = {},
): ConversationEntity {
  return {
    id: 'conv-1',
    scope: documentScope('doc-1'),
    title: '¿Total?',
    messageCount: 2,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function message(role: 'user' | 'assistant', text: string) {
  return { role, text, createdAt: NOW };
}

describe('DynamoDbConversationRepository', () => {
  const dynamo = mockClient(DynamoDBDocumentClient);
  let repository: DynamoDbConversationRepository;

  beforeEach(() => {
    dynamo.reset();
    const config = {
      get: (key: keyof Env) => TABLES[key],
    } as unknown as ConfigService<Env, true>;
    repository = new DynamoDbConversationRepository(
      DynamoDBDocumentClient.from(new DynamoDBClient({})),
      config,
    );
  });

  it('creates an empty conversation keyed by its scope', async () => {
    dynamo.on(PutCommand).resolves({});

    const created = await repository.create({
      id: 'conv-1',
      scope: COLLECTION_SCOPE,
      title: '¿Total?',
    });

    expect(created.messageCount).toBe(0);
    expect(dynamo.commandCalls(PutCommand)[0].args[0].input).toMatchObject({
      TableName: 'docuia-conversations',
      Item: { id: 'conv-1', scopeKey: 'COLLECTION', messageCount: 0 },
      ConditionExpression: 'attribute_not_exists(id)',
    });
  });

  it('finds a conversation and reads its scope back', async () => {
    const conversation = buildConversation();
    dynamo.on(GetCommand).resolves({ Item: toConversationItem(conversation) });

    await expect(repository.findById('conv-1')).resolves.toEqual(conversation);
  });

  it('lists the conversations of a scope that have messages, newest first', async () => {
    dynamo.on(QueryCommand).resolves({
      Items: [
        toConversationItem(
          buildConversation({ id: 'conv-2', messageCount: 0 }),
        ),
        toConversationItem(buildConversation({ id: 'conv-1' })),
      ],
    });

    const listed = await repository.listByScope(documentScope('doc-1'), 20);

    expect(listed.map((conversation) => conversation.id)).toEqual(['conv-1']);
    expect(dynamo.commandCalls(QueryCommand)[0].args[0].input).toMatchObject({
      IndexName: 'byScope',
      ExpressionAttributeValues: { ':scopeKey': 'doc-1' },
      ScanIndexForward: false,
    });
  });

  it('returns the recent messages oldest first', async () => {
    dynamo.on(QueryCommand).resolves({
      Items: [
        toMessageItem('conv-1', 3, message('assistant', 'B')),
        toMessageItem('conv-1', 2, message('user', 'A')),
      ],
    });

    const messages = await repository.findRecentMessages('conv-1', 2);

    expect(messages.map((item) => item.text)).toEqual(['A', 'B']);
    expect(dynamo.commandCalls(QueryCommand)[0].args[0].input).toMatchObject({
      TableName: 'docuia-messages',
      ScanIndexForward: false,
      Limit: 2,
    });
  });

  it('reads every page of messages', async () => {
    dynamo
      .on(QueryCommand)
      .resolvesOnce({
        Items: [toMessageItem('conv-1', 0, message('user', 'A'))],
        LastEvaluatedKey: { conversationId: 'conv-1', sequence: 0 },
      })
      .resolvesOnce({
        Items: [toMessageItem('conv-1', 1, message('assistant', 'B'))],
      });

    const messages = await repository.findAllMessages('conv-1');

    expect(messages.map((item) => item.text)).toEqual(['A', 'B']);
  });

  it('appends the messages and the new count in one transaction', async () => {
    dynamo
      .on(GetCommand)
      .resolves({ Item: toConversationItem(buildConversation()) });
    dynamo.on(TransactWriteCommand).resolves({});

    await repository.appendMessages('conv-1', [
      message('user', '¿Y el IVA?'),
      message('assistant', '19 %.'),
    ]);

    const [put1, put2, update] =
      dynamo.commandCalls(TransactWriteCommand)[0].args[0].input
        .TransactItems ?? [];
    expect(put1.Put?.Item).toMatchObject({ sequence: 2, role: 'user' });
    expect(put2.Put?.Item).toMatchObject({ sequence: 3, role: 'assistant' });
    expect(update.Update).toMatchObject({
      ConditionExpression: 'messageCount = :currentCount',
      ExpressionAttributeValues: { ':currentCount': 2, ':newCount': 4 },
    });
  });

  it('appends nothing to a conversation that does not exist', async () => {
    dynamo.on(GetCommand).resolves({});

    await repository.appendMessages('conv-9', [message('user', 'Hola')]);

    expect(dynamo.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });
});
