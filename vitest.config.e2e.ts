import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Las lee la validación de variables al importar AppModule. MongoDB se
    // reemplaza por un repositorio en memoria y la API no llama al LLM, así que
    // la URI y la key nunca se usan.
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://unused-in-e2e',
      OPENAI_API_KEY: 'sk-unused-in-e2e',
      LOCAL_STORAGE_DIR: '.tmp/e2e-uploads',
      MAX_UPLOAD_SIZE_MB: '1',
    },
  },
});
