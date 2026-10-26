import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildSetExpression } from '../../common/aws/build-set-expression.js';
import { Env } from '../../config/env.schema.js';
import { requireConfig } from '../../config/require-config.js';
import {
  DocumentPage,
  DocumentPageRequest,
  toDocumentPage,
} from '../domain/document-page.js';
import { DocumentSearchCriteria } from '../domain/document-search-criteria.js';
import {
  DocumentChanges,
  DocumentEntity,
  NewDocument,
} from '../domain/document.entity.js';
import { matchesSearchCriteria } from '../domain/matches-search-criteria.js';
import { DocumentRepository } from './document.repository.js';
import {
  DOCUMENT_LIST_KEY,
  DOCUMENTS_BY_CREATED_AT_INDEX,
  DocumentItem,
  startKeyOf,
  toDocumentEntity,
  toDocumentItem,
} from './dynamodb-document.mapper.js';

/**
 * Documentos que `search` revisa como máximo: DynamoDB no busca texto, así que
 * se filtra en código sobre los más recientes. Suficiente para este tamaño.
 */
export const DYNAMODB_SEARCH_SCAN_LIMIT = 200;
const SEARCH_BATCH_SIZE = 50;

type StartKey = Record<string, unknown> | undefined;

interface NewestFirstBatch {
  documents: DocumentEntity[];
  nextKey: StartKey;
}

@Injectable()
export class DynamoDbDocumentRepository extends DocumentRepository {
  private readonly tableName: string;

  constructor(
    private readonly client: DynamoDBDocumentClient,
    config: ConfigService<Env, true>,
  ) {
    super();
    this.tableName = requireConfig(config, 'DYNAMODB_DOCUMENTS_TABLE');
  }

  async create(document: NewDocument): Promise<DocumentEntity> {
    const now = new Date();
    const entity = { ...document, createdAt: now, updatedAt: now };
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: toDocumentItem(entity),
        ConditionExpression: 'attribute_not_exists(id)',
      }),
    );
    return entity;
  }

  async findById(id: string): Promise<DocumentEntity | null> {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { id } }),
    );
    return Item ? toDocumentEntity(Item as DocumentItem) : null;
  }

  async findPage(request: DocumentPageRequest): Promise<DocumentPage> {
    // Se pide uno de más para saber si existe una página siguiente.
    const { documents } = await this.queryNewestFirst(
      request.limit + 1,
      request.after ? startKeyOf(request.after) : undefined,
    );
    return toDocumentPage(documents, request.limit);
  }

  async search(criteria: DocumentSearchCriteria): Promise<DocumentEntity[]> {
    const matches: DocumentEntity[] = [];
    let startKey: StartKey;
    let scanned = 0;
    do {
      const batch = await this.queryNewestFirst(SEARCH_BATCH_SIZE, startKey);
      scanned += batch.documents.length;
      matches.push(
        ...batch.documents.filter((document) =>
          matchesSearchCriteria(document, criteria),
        ),
      );
      startKey = batch.nextKey;
    } while (
      startKey &&
      matches.length < criteria.limit &&
      scanned < DYNAMODB_SEARCH_SCAN_LIMIT
    );
    return matches.slice(0, criteria.limit);
  }

  /** Devuelve null si el documento no existe (la condición evita crearlo). */
  async update(
    id: string,
    changes: DocumentChanges,
  ): Promise<DocumentEntity | null> {
    try {
      const { Attributes } = await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { id },
          ...buildSetExpression({
            ...changes,
            updatedAt: new Date().toISOString(),
          }),
          ConditionExpression: 'attribute_exists(id)',
          ReturnValues: 'ALL_NEW',
        }),
      );
      return toDocumentEntity(Attributes as DocumentItem);
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        return null;
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({ TableName: this.tableName, Key: { id } }),
    );
  }

  /** Lee el índice por fecha, del documento más reciente al más antiguo. */
  private async queryNewestFirst(
    limit: number,
    startKey: StartKey,
  ): Promise<NewestFirstBatch> {
    const { Items = [], LastEvaluatedKey } = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: DOCUMENTS_BY_CREATED_AT_INDEX,
        KeyConditionExpression: 'listKey = :listKey',
        ExpressionAttributeValues: { ':listKey': DOCUMENT_LIST_KEY },
        ScanIndexForward: false,
        Limit: limit,
        ExclusiveStartKey: startKey,
      }),
    );
    return {
      documents: Items.map((item) => toDocumentEntity(item as DocumentItem)),
      nextKey: LastEvaluatedKey,
    };
  }
}
