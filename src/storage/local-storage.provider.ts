import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Env } from '../config/env.schema.js';
import { StorageProvider } from './storage.provider.js';

@Injectable()
export class LocalStorageProvider extends StorageProvider {
  private readonly baseDir: string;

  constructor(config: ConfigService<Env, true>) {
    super();
    this.baseDir = resolve(config.get('LOCAL_STORAGE_DIR', { infer: true }));
  }

  async save(key: string, content: Buffer): Promise<void> {
    const filePath = this.resolveKey(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }

  read(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  private resolveKey(key: string): string {
    const filePath = resolve(this.baseDir, key);
    if (!filePath.startsWith(this.baseDir + sep)) {
      throw new Error(`Storage key escapes the storage directory: ${key}`);
    }
    return filePath;
  }
}
