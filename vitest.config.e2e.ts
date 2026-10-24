import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Read by the env validation when AppModule is imported. MongoDB is
    // replaced by an in-memory repository, so the URI is never used.
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://unused-in-e2e',
      LOCAL_STORAGE_DIR: '.tmp/e2e-uploads',
      MAX_UPLOAD_SIZE_MB: '1',
    },
  },
});
