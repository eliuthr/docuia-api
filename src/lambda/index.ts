/**
 * Punto de entrada de la Lambda del worker (`dist/lambda/index.handler`).
 *
 * Lambda lee el handler como `archivo.función` y corta en el primer punto del
 * nombre del archivo, así que no puede apuntar a `sqs-worker.handler.js`: este
 * archivo sin puntos en el nombre solo reexporta el handler.
 */
export { handler } from './sqs-worker.handler.js';
