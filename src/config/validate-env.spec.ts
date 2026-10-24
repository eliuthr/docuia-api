import { validateEnv } from './validate-env.js';

const MONGODB_URI = 'mongodb://localhost:27017/docuia';

describe('validateEnv', () => {
  it('applies defaults when only required variables are set', () => {
    const env = validateEnv({ MONGODB_URI });

    expect(env).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      CORS_ORIGIN: 'http://localhost:4200',
      MONGODB_URI,
      STORAGE_DRIVER: 'local',
      LOCAL_STORAGE_DIR: './uploads',
      MAX_UPLOAD_SIZE_MB: 10,
      QUEUE_DRIVER: 'bullmq',
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      PROCESSING_MAX_ATTEMPTS: 3,
      PROCESSING_BACKOFF_MS: 5000,
      WORKER_CONCURRENCY: 2,
    });
  });

  it('rejects zero processing attempts', () => {
    expect(() =>
      validateEnv({ MONGODB_URI, PROCESSING_MAX_ATTEMPTS: '0' }),
    ).toThrow(/PROCESSING_MAX_ATTEMPTS/);
  });

  it('coerces numeric variables from strings', () => {
    const env = validateEnv({
      MONGODB_URI,
      PORT: '8080',
      MAX_UPLOAD_SIZE_MB: '5',
    });

    expect(env.PORT).toBe(8080);
    expect(env.MAX_UPLOAD_SIZE_MB).toBe(5);
  });

  it('names the missing variable when a required one is absent', () => {
    expect(() => validateEnv({})).toThrow(/MONGODB_URI/);
  });

  it('rejects an unsupported storage driver', () => {
    expect(() => validateEnv({ MONGODB_URI, STORAGE_DRIVER: 'ftp' })).toThrow(
      /STORAGE_DRIVER/,
    );
  });

  it('rejects an upload limit above the maximum', () => {
    expect(() =>
      validateEnv({ MONGODB_URI, MAX_UPLOAD_SIZE_MB: '500' }),
    ).toThrow(/MAX_UPLOAD_SIZE_MB/);
  });
});
