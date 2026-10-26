import {
  DeleteObjectCommand,
  GetObjectCommand,
  GetObjectCommandOutput,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { mockClient } from 'aws-sdk-client-mock';
import { Env } from '../config/env.schema.js';
import { S3StorageProvider } from './s3-storage.provider.js';

const BUCKET = 'docuia-files';

/** Lo único que el provider usa del cuerpo que entrega el SDK. */
function s3Body(text: string): GetObjectCommandOutput['Body'] {
  const body = {
    transformToByteArray: () =>
      Promise.resolve(new Uint8Array(Buffer.from(text))),
  };
  return body as unknown as GetObjectCommandOutput['Body'];
}

describe('S3StorageProvider', () => {
  const s3 = mockClient(S3Client);
  let storage: S3StorageProvider;

  beforeEach(() => {
    s3.reset();
    const config = {
      get: () => BUCKET,
    } as unknown as ConfigService<Env, true>;
    storage = new S3StorageProvider(new S3Client({}), config);
  });

  it('saves the content as an object of the bucket', async () => {
    s3.on(PutObjectCommand).resolves({});

    await storage.save('doc-1.pdf', Buffer.from('%PDF'));

    expect(s3.commandCalls(PutObjectCommand)[0].args[0].input).toEqual({
      Bucket: BUCKET,
      Key: 'doc-1.pdf',
      Body: Buffer.from('%PDF'),
    });
  });

  it('reads the object content', async () => {
    s3.on(GetObjectCommand, { Bucket: BUCKET, Key: 'doc-1.txt' }).resolves({
      Body: s3Body('Factura FE-1024'),
    });

    const content = await storage.read('doc-1.txt');

    expect(content.toString('utf8')).toBe('Factura FE-1024');
  });

  it('throws when the object does not exist', async () => {
    s3.on(GetObjectCommand).rejects(
      new NoSuchKey({
        message: 'The specified key does not exist.',
        $metadata: {},
      }),
    );

    await expect(storage.read('missing.pdf')).rejects.toBeInstanceOf(NoSuchKey);
  });

  it('deletes the object', async () => {
    s3.on(DeleteObjectCommand).resolves({});

    await storage.delete('doc-1.pdf');

    expect(s3.commandCalls(DeleteObjectCommand)[0].args[0].input).toEqual({
      Bucket: BUCKET,
      Key: 'doc-1.pdf',
    });
  });
});
