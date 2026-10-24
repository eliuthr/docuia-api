import { Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AnswerEvent } from './answer-event.js';

export const ANSWER_FAILED_MESSAGE =
  'The answer could not be completed. Try again.';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  // Evita que un proxy (por ejemplo, nginx) acumule la respuesta en vez de transmitirla.
  'X-Accel-Buffering': 'no',
} as const;

const logger = new Logger('SseWriter');

/**
 * Crea un AbortSignal que se dispara si el cliente cierra la conexión antes de
 * que termine la respuesta, para dejar de llamar al modelo (y de gastar tokens).
 */
export function abortOnClientDisconnect(response: Response): AbortSignal {
  const controller = new AbortController();
  response.on('close', () => {
    if (!response.writableEnded) {
      controller.abort();
    }
  });
  return controller.signal;
}

/**
 * Escribe los eventos como Server-Sent Events. Una vez enviados los
 * encabezados ya no se puede cambiar el código HTTP, así que un error se
 * comunica con un evento `error` y se cierra el stream.
 */
export async function writeSse(
  response: Response,
  events: AsyncIterable<AnswerEvent>,
  signal: AbortSignal,
): Promise<void> {
  response.writeHead(200, SSE_HEADERS);
  try {
    for await (const { type, ...payload } of events) {
      writeEvent(response, type, payload);
    }
  } catch (error) {
    if (!signal.aborted) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ event: 'question.failed', error: message });
      writeEvent(response, 'error', { message: ANSWER_FAILED_MESSAGE });
    }
  } finally {
    response.end();
  }
}

function writeEvent(response: Response, type: string, payload: object): void {
  response.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
}
