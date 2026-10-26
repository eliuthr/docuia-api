import {
  ConditionalCheckFailedException,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';
import { mockClient } from 'aws-sdk-client-mock';
import { buildDocument } from '../../../test/support/build-document.js';
import { Env } from '../../config/env.schema.js';
import { DocumentStatus } from '../domain/document-status.enum.js';
import { DocumentEntity } from '../domain/document.entity.js';
import { DynamoDbDocumentRepository } from './dynamodb-document.repository.js';
import { toDocumentItem } from './dynamodb-document.mapper.js';

const TABLE = 'docuia-documents';
const SEARCH_ALL_READY = {
  status: DocumentStatus.Ready,
  documentType: null,
  text: null,
  limit: 2,
};

function documentNumber(number: number): DocumentEntity {
  return buildDocument({
    id: `doc-${number}`,
    createdAt: new Date(Date.UTC(2026, 9, number)),
  });
}

describe('DynamoDbDocumentRepository', () => {
  const dynamo = mockClient(DynamoDBDocumentClient);
  let repository: DynamoDbDocumentRepository;

  beforeEach(() => {
    dynamo.reset();
    const config = { get: () => TABLE } as unknown as ConfigService<Env, true>;
    repository = new DynamoDbDocumentRepository(
      DynamoDBDocumentClient.from(new DynamoDBClient({})),
      config,
    );
  });

  it('creates the item with the index keys and never overwrites one', async () => {
    dynamo.on(PutCommand).resolves({});
    const {
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...newDocument
    } = buildDocument();

    const created = await repository.create(newDocument);

    const input = dynamo.commandCalls(PutCommand)[0].args[0].input;
    expect(input.TableName).toBe(TABLE);
    expect(input.ConditionExpression).toBe('attribute_not_exists(id)');
    expect(input.Item).toEqual(toDocumentItem(created));
    expect(input.Item?.createdAtId).toBe(
      `${created.createdAt.toISOString()}#doc-1`,
    );
  });

  it('finds a document by id and returns null when it does not exist', async () => {
    const document = buildDocument();
    dynamo
      .on(GetCommand, { Key: { id: 'doc-1' } })
      .resolves({ Item: toDocumentItem(document) })
      .on(GetCommand, { Key: { id: 'doc-9' } })
      .resolves({});

    await expect(repository.findById('doc-1')).resolves.toEqual(document);
    await expect(repository.findById('doc-9')).resolves.toBeNull();
  });

  it('reads a page newest first and continues after the cursor', async () => {
    const newest = documentNumber(3);
    const middle = documentNumber(2);
    dynamo.on(QueryCommand).resolves({
      Items: [toDocumentItem(newest), toDocumentItem(middle)],
    });

    const page = await repository.findPage({
      limit: 1,
      after: { createdAt: new Date(Date.UTC(2026, 9, 4)), id: 'doc-4' },
    });

    expect(page).toEqual({
      documents: [newest],
      nextCursor: { createdAt: newest.createdAt, id: 'doc-3' },
    });
    expect(dynamo.commandCalls(QueryCommand)[0].args[0].input).toMatchObject({
      IndexName: 'byCreatedAt',
      ScanIndexForward: false,
      Limit: 2,
      ExclusiveStartKey: {
        id: 'doc-4',
        listKey: 'DOCUMENT',
        createdAtId: '2026-10-04T00:00:00.000Z#doc-4',
      },
    });
  });

  it('searches newest first, filtering in code, until it has enough matches', async () => {
    const processing = buildDocument({
      id: 'doc-5',
      status: DocumentStatus.Processing,
    });
    dynamo
      .on(QueryCommand)
      .resolvesOnce({
        Items: [toDocumentItem(processing), toDocumentItem(documentNumber(4))],
        LastEvaluatedKey: { id: 'doc-4' },
      })
      .resolvesOnce({
        Items: [
          toDocumentItem(documentNumber(3)),
          toDocumentItem(documentNumber(2)),
        ],
        LastEvaluatedKey: { id: 'doc-2' },
      });

    const found = await repository.search(SEARCH_ALL_READY);

    expect(found.map((document) => document.id)).toEqual(['doc-4', 'doc-3']);
    expect(dynamo.commandCalls(QueryCommand)).toHaveLength(2);
  });

  it('stops searching when there are no more documents', async () => {
    dynamo.on(QueryCommand).resolves({ Items: [] });

    await expect(repository.search(SEARCH_ALL_READY)).resolves.toEqual([]);
    expect(dynamo.commandCalls(QueryCommand)).toHaveLength(1);
  });

  it('updates only the changed fields and returns the new document', async () => {
    const updated = buildDocument({ status: DocumentStatus.Failed });
    dynamo.on(UpdateCommand).resolves({ Attributes: toDocumentItem(updated) });

    await expect(
      repository.update('doc-1', {
        status: DocumentStatus.Failed,
        failureReason: 'corrupt',
      }),
    ).resolves.toEqual(updated);

    const input = dynamo.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input.UpdateExpression).toBe('SET #f0 = :v0, #f1 = :v1, #f2 = :v2');
    expect(input.ExpressionAttributeNames).toEqual({
      '#f0': 'status',
      '#f1': 'failureReason',
      '#f2': 'updatedAt',
    });
    expect(input.ConditionExpression).toBe('attribute_exists(id)');
  });

  it('returns null when updating a document that does not exist', async () => {
    dynamo.on(UpdateCommand).rejects(
      new ConditionalCheckFailedException({
        message: 'The conditional request failed',
        $metadata: {},
      }),
    );

    await expect(
      repository.update('doc-9', { status: DocumentStatus.Ready }),
    ).resolves.toBeNull();
  });

  it('deletes by id', async () => {
    dynamo.on(DeleteCommand).resolves({});

    await repository.delete('doc-1');

    expect(dynamo.commandCalls(DeleteCommand)[0].args[0].input).toEqual({
      TableName: TABLE,
      Key: { id: 'doc-1' },
    });
  });
});
