import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Env } from '../config/env.schema.js';
import { LocalStorageProvider } from './local-storage.provider.js';

describe('LocalStorageProvider', () => {
  let baseDir: string;
  let storage: LocalStorageProvider;

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), 'docuia-storage-'));
    const config = {
      get: () => baseDir,
    } as unknown as ConfigService<Env, true>;
    storage = new LocalStorageProvider(config);
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it('writes the content under the storage directory', async () => {
    await storage.save('invoice.pdf', Buffer.from('content'));

    const stored = await readFile(join(baseDir, 'invoice.pdf'), 'utf8');
    expect(stored).toBe('content');
  });

  it('removes a stored file', async () => {
    await storage.save('invoice.pdf', Buffer.from('content'));

    await storage.delete('invoice.pdf');

    await expect(readFile(join(baseDir, 'invoice.pdf'))).rejects.toThrow();
  });

  it('ignores deleting a file that does not exist', async () => {
    await expect(storage.delete('missing.pdf')).resolves.toBeUndefined();
  });

  it('rejects keys that escape the storage directory', async () => {
    await expect(
      storage.save('../outside.pdf', Buffer.from('content')),
    ).rejects.toThrow(/escapes/);
  });
});
