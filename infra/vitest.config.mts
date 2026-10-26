import { defineConfig } from 'vitest/config';

// Configuración propia: sin ella, Vitest usaría la de la API (carpeta padre).
export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts'],
  },
});
