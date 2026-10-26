// Empaqueta la API para Lambda: dist/ + dependencias de producción + run.sh en
// un zip que comparten las dos funciones (API y worker).
//
// El zip se crea dentro de un contenedor Linux porque los zips hechos en
// Windows no guardan el permiso de ejecución que necesita run.sh.
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const infraDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = resolve(infraDir, '..');
const lambdaPackage = JSON.parse(
  readFileSync(join(infraDir, 'lambda-package.json'), 'utf8'),
);
const buildDir = join(infraDir, lambdaPackage.buildDir);
const stagingDir = join(buildDir, 'staging');

/** Imagen pequeña con `zip`; ECR Public evita los límites de descarga de Docker Hub. */
const ZIP_IMAGE = 'public.ecr.aws/docker/library/alpine:3.22';
/** run.sh lo ejecuta el Lambda Web Adapter; debe tener saltos de línea LF. */
const RUN_SCRIPT = '#!/bin/sh\nexec node dist/main.js\n';
const PRUNED_SUFFIXES = ['.d.ts', '.d.mts', '.d.cts', '.map', '.md'];
/** Lambda admite 250 MB descomprimidos contando las capas; se deja margen. */
const MAX_UNZIPPED_MB = 200;
const BYTES_PER_MB = 1024 * 1024;

function run(command, args, cwd) {
  console.log(`> ${command} ${args.join(' ')}`);
  // npm es un .cmd en Windows y necesita una shell; los argumentos son
  // constantes de este script, así que se pasan como un solo comando.
  const needsShell = process.platform === 'win32' && command === 'npm';
  const result = needsShell
    ? spawnSync([command, ...args].join(' '), {
        cwd,
        stdio: 'inherit',
        shell: true,
      })
    : spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}`);
  }
}

function stageApp() {
  rmSync(buildDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });
  cpSync(join(apiDir, 'dist'), join(stagingDir, 'dist'), { recursive: true });
  for (const file of ['package.json', 'package-lock.json']) {
    cpSync(join(apiDir, file), join(stagingDir, file));
  }
  writeFileSync(join(stagingDir, 'run.sh'), RUN_SCRIPT);
}

/** Solo dependencias de producción, eligiendo los binarios opcionales de Linux arm64. */
function installProductionDependencies() {
  run(
    'npm',
    ['ci', '--omit=dev', '--ignore-scripts', '--os=linux', '--cpu=arm64'],
    stagingDir,
  );
}

/**
 * Quita de las dependencias lo que nunca se ejecuta (tipos, source maps,
 * documentación): es casi la mitad del tamaño.
 */
function pruneDependencies() {
  const entries = readdirSync(join(stagingDir, 'node_modules'), {
    recursive: true,
    withFileTypes: true,
  });
  for (const entry of entries) {
    const isUnused = PRUNED_SUFFIXES.some((suffix) =>
      entry.name.endsWith(suffix),
    );
    if (entry.isFile() && isUnused) {
      rmSync(join(entry.parentPath, entry.name));
    }
  }
}

/** Falla aquí, y no al desplegar, si el paquete se acerca al límite de Lambda. */
function assertPackageSize() {
  const entries = readdirSync(stagingDir, {
    recursive: true,
    withFileTypes: true,
  });
  const totalBytes = entries
    .filter((entry) => entry.isFile())
    .reduce(
      (sum, entry) => sum + statSync(join(entry.parentPath, entry.name)).size,
      0,
    );
  const totalMb = totalBytes / BYTES_PER_MB;
  console.log(`Unzipped package size: ${totalMb.toFixed(1)} MB`);
  if (totalMb > MAX_UNZIPPED_MB) {
    throw new Error(
      `The Lambda package is ${totalMb.toFixed(1)} MB; the budget is ${MAX_UNZIPPED_MB} MB.`,
    );
  }
}

function zipWithUnixPermissions() {
  run(
    'docker',
    [
      'run',
      '--rm',
      '-v',
      `${buildDir}:/build`,
      ZIP_IMAGE,
      'sh',
      '-c',
      [
        'apk add --no-cache zip > /dev/null',
        'cd /build/staging',
        'chmod 755 run.sh',
        `zip -qr -X /build/${lambdaPackage.zipFile} .`,
      ].join(' && '),
    ],
    infraDir,
  );
}

run('npm', ['run', 'build'], apiDir);
stageApp();
installProductionDependencies();
pruneDependencies();
assertPackageSize();
zipWithUnixPermissions();
console.log(`Lambda package ready: ${join(buildDir, lambdaPackage.zipFile)}`);
