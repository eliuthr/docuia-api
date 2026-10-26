import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.schema.js';
import { requireConfig } from '../config/require-config.js';
import { StorageProvider } from './storage.provider.js';

/**
 * Guarda los archivos como objetos en un bucket privado de S3. La clave del
 * objeto es la misma que en disco local, así que el resto del código no cambia.
 */
@Injectable()
export class S3StorageProvider extends StorageProvider {
  private readonly bucket: string;

  constructor(
    private readonly s3: S3Client,
    config: ConfigService<Env, true>,
  ) {
    super();
    this.bucket = requireConfig(config, 'S3_BUCKET');
  }

  async save(key: string, content: Buffer): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: content }),
    );
  }

  /** Si el objeto no existe, S3 responde `NoSuchKey` y el error se propaga, como en disco. */
  async read(key: string): Promise<Buffer> {
    const { Body } = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!Body) {
      throw new Error(`Empty S3 object: ${key}`);
    }
    return Buffer.from(await Body.transformToByteArray());
  }

  /** Borrar un objeto que no existe no es un error en S3, igual que en disco. */
  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
