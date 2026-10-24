import { validateEnv } from './validate-env.js';

const MONGODB_URI = 'mongodb://localhost:27017/docuia';
const OPENAI_API_KEY = 'sk-test';
const REQUIRED = { MONGODB_URI, OPENAI_API_KEY };

describe('validateEnv', () => {
  it('applies defaults when only required variables are set', () => {
    const env = validateEnv(REQUIRED);

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
      LLM_DRIVER: 'openai',
      OPENAI_API_KEY,
      OPENAI_MODEL: 'gpt-6-luna',
      LLM_TIMEOUT_MS: 60000,
      LLM_MAX_INPUT_CHARS: 50000,
    });
  });

  it('rejects zero processing attempts', () => {
    expect(() =>
      validateEnv({ ...REQUIRED, PROCESSING_MAX_ATTEMPTS: '0' }),
    ).toThrow(/PROCESSING_MAX_ATTEMPTS/);
  });

  it('coerces numeric variables from strings', () => {
    const env = validateEnv({
      ...REQUIRED,
      PORT: '8080',
      MAX_UPLOAD_SIZE_MB: '5',
    });

    expect(env.PORT).toBe(8080);
    expect(env.MAX_UPLOAD_SIZE_MB).toBe(5);
  });

  it('names the missing variable when a required one is absent', () => {
    expect(() => validateEnv({})).toThrow(/MONGODB_URI/);
  });

  it('requires the OpenAI API key', () => {
    expect(() => validateEnv({ MONGODB_URI })).toThrow(/OPENAI_API_KEY/);
  });

  it('rejects an unsupported LLM driver', () => {
    expect(() => validateEnv({ ...REQUIRED, LLM_DRIVER: 'gemini' })).toThrow(
      /LLM_DRIVER/,
    );
  });

  it('rejects an LLM input limit below the minimum', () => {
    expect(() =>
      validateEnv({ ...REQUIRED, LLM_MAX_INPUT_CHARS: '10' }),
    ).toThrow(/LLM_MAX_INPUT_CHARS/);
  });

  it('rejects an unsupported storage driver', () => {
    expect(() => validateEnv({ ...REQUIRED, STORAGE_DRIVER: 'ftp' })).toThrow(
      /STORAGE_DRIVER/,
    );
  });

  it('rejects an upload limit above the maximum', () => {
    expect(() =>
      validateEnv({ ...REQUIRED, MAX_UPLOAD_SIZE_MB: '500' }),
    ).toThrow(/MAX_UPLOAD_SIZE_MB/);
  });
});
