import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Env } from '../config/env.schema.js';
import { requireConfig } from '../config/require-config.js';

/** Conexión a MongoDB; Mongoose la comparte con todos los modelos. */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        uri: requireConfig(config, 'MONGODB_URI'),
      }),
    }),
  ],
})
export class MongoDatabaseModule {}
