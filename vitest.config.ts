import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resuelve los alias de rutas declarados en tsconfig.json, incluidos los que
  // agrega `nest g library`. Requiere Vite 8, que trae esta opción.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
  },
});
