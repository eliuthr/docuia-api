import { RemovalPolicy } from 'aws-cdk-lib';
import {
  AttributeType,
  BillingMode,
  Table,
  TableProps,
} from 'aws-cdk-lib/aws-dynamodb';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
} from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

/**
 * Unidades de lectura y escritura por tabla e índice. Son 3 tablas y 2 índices:
 * 5 × 5 = 25 de cada una, justo la capa gratuita permanente de DynamoDB.
 */
export const CAPACITY_UNITS = 5;

/** Deben coincidir con los nombres que usan los repositorios de la API. */
export const DOCUMENTS_BY_CREATED_AT_INDEX = 'byCreatedAt';
export const CONVERSATIONS_BY_SCOPE_INDEX = 'byScope';

/** Se conservan al hacer `cdk destroy`, para no perder datos por accidente. */
const RETAIN = { removalPolicy: RemovalPolicy.RETAIN };

const PROVISIONED: Pick<
  TableProps,
  'billingMode' | 'readCapacity' | 'writeCapacity'
> = {
  billingMode: BillingMode.PROVISIONED,
  readCapacity: CAPACITY_UNITS,
  writeCapacity: CAPACITY_UNITS,
};

/** El bucket de archivos y las tablas de DynamoDB. */
export class DataStores extends Construct {
  readonly bucket: Bucket;
  readonly documentsTable: Table;
  readonly conversationsTable: Table;
  readonly messagesTable: Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.bucket = new Bucket(this, 'Files', {
      ...RETAIN,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });
    this.documentsTable = this.createDocumentsTable();
    this.conversationsTable = this.createConversationsTable();
    this.messagesTable = new Table(this, 'Messages', {
      ...RETAIN,
      ...PROVISIONED,
      partitionKey: { name: 'conversationId', type: AttributeType.STRING },
      sortKey: { name: 'sequence', type: AttributeType.NUMBER },
    });
  }

  /** Índice con una sola partición para listar todos los documentos por fecha. */
  private createDocumentsTable(): Table {
    const table = new Table(this, 'Documents', {
      ...RETAIN,
      ...PROVISIONED,
      partitionKey: { name: 'id', type: AttributeType.STRING },
    });
    table.addGlobalSecondaryIndex({
      indexName: DOCUMENTS_BY_CREATED_AT_INDEX,
      partitionKey: { name: 'listKey', type: AttributeType.STRING },
      sortKey: { name: 'createdAtId', type: AttributeType.STRING },
      readCapacity: CAPACITY_UNITS,
      writeCapacity: CAPACITY_UNITS,
    });
    return table;
  }

  /** Índice por alcance (documento o colección), ordenado por última actividad. */
  private createConversationsTable(): Table {
    const table = new Table(this, 'Conversations', {
      ...RETAIN,
      ...PROVISIONED,
      partitionKey: { name: 'id', type: AttributeType.STRING },
    });
    table.addGlobalSecondaryIndex({
      indexName: CONVERSATIONS_BY_SCOPE_INDEX,
      partitionKey: { name: 'scopeKey', type: AttributeType.STRING },
      sortKey: { name: 'updatedAt', type: AttributeType.STRING },
      readCapacity: CAPACITY_UNITS,
      writeCapacity: CAPACITY_UNITS,
    });
    return table;
  }
}
