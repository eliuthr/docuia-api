import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageProvider } from './local-storage.provider.js';
import { S3StorageProvider } from './s3-storage.provider.js';
import { StorageModule } from './storage.module.js';
import { StorageProvider } from './storage.provider.js';

describe('StorageModule', () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), 'docuia-storage-module-'));
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it('provides a fully initialized local storage for the local driver', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({ STORAGE_DRIVER: 'local', LOCAL_STORAGE_DIR: baseDir }),
          ],
        }),
        StorageModule,
      ],
    }).compile();

    const storage = moduleRef.get(StorageProvider);
    await storage.save('invoice.pdf', Buffer.from('content'));

    expect(storage).toBeInstanceOf(LocalStorageProvider);
    expect(await readFile(join(baseDir, 'invoice.pdf'), 'utf8')).toBe(
      'content',
    );
  });

  it('provides the S3 storage for the s3 driver', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              STORAGE_DRIVER: 's3',
              S3_BUCKET: 'docuia-files',
              AWS_REGION: 'us-east-1',
            }),
          ],
        }),
        StorageModule,
      ],
    }).compile();

    expect(moduleRef.get(StorageProvider)).toBeInstanceOf(S3StorageProvider);
  });
});
