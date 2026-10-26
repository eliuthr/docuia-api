import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { SQSClient } from '@aws-sdk/client-sqs';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema.js';

/**
 * Clientes del SDK de AWS. Crearlos no abre conexiones: las credenciales se
 * resuelven en la primera llamada (en Lambda, del rol de la función).
 */
function regionOf(config: ConfigService<Env, true>): { region: string } {
  return { region: config.get('AWS_REGION', { infer: true }) };
}

export const s3ClientProvider: FactoryProvider<S3Client> = {
  provide: S3Client,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) =>
    new S3Client(regionOf(config)),
};

export const sqsClientProvider: FactoryProvider<SQSClient> = {
  provide: SQSClient,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) =>
    new SQSClient(regionOf(config)),
};

/**
 * Cliente "document" de DynamoDB: convierte objetos de JavaScript a items y de
 * vuelta, sin escribir los tipos de DynamoDB (`{ S: '...' }`) a mano.
 */
export const dynamoDbDocumentClientProvider: FactoryProvider<DynamoDBDocumentClient> =
  {
    provide: DynamoDBDocumentClient,
    inject: [ConfigService],
    useFactory: (config: ConfigService<Env, true>) =>
      DynamoDBDocumentClient.from(new DynamoDBClient(regionOf(config)), {
        marshallOptions: { removeUndefinedValues: true },
      }),
  };
