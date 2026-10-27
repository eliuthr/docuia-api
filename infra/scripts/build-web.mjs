// Compila el cliente web (docuia-web, un repositorio hermano de docuia-api)
// en modo producción; el stack de CDK sube el resultado a S3.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const infraDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webApp = JSON.parse(readFileSync(join(infraDir, 'web-app.json'), 'utf8'));
const webDir = resolve(infraDir, webApp.webDir);

if (!existsSync(join(webDir, 'node_modules'))) {
  throw new Error(
    `No dependencies in ${webDir}. Clone docuia-web next to docuia-api and run "npm ci" there.`,
  );
}

console.log(`> npm run build (${webDir})`);
// npm es un .cmd en Windows y necesita una shell; el comando es constante.
const result = spawnSync('npm run build', {
  cwd: webDir,
  stdio: 'inherit',
  shell: true,
});
if (result.status !== 0) {
  throw new Error(`npm run build failed with exit code ${result.status}`);
}
console.log(`Web client ready: ${join(webDir, webApp.buildDir)}`);
