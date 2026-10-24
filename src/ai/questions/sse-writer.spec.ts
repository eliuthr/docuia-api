import { Logger } from '@nestjs/common';
import type { Response } from 'express';
import { EventEmitter } from 'node:events';
import { AnswerEvent } from './answer-event.js';
import {
  abortOnClientDisconnect,
  ANSWER_FAILED_MESSAGE,
  writeSse,
} from './sse-writer.js';

class FakeResponse extends EventEmitter {
  writableEnded = false;
  status: number | null = null;
  headers: Record<string, string> = {};
  body = '';

  writeHead(status: number, headers: Record<string, string>): this {
    this.status = status;
    this.headers = headers;
    return this;
  }

  write(chunk: string): boolean {
    this.body += chunk;
    return true;
  }

  end(): this {
    this.writableEnded = true;
    return this;
  }
}

async function* eventsOf(
  events: AnswerEvent[],
  failure?: Error,
): AsyncGenerator<AnswerEvent> {
  for (const event of events) {
    yield await Promise.resolve(event);
  }
  if (failure) {
    throw failure;
  }
}

describe('sse writer', () => {
  let response: FakeResponse;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    response = new FakeResponse();
  });

  it('writes each event in SSE format and ends the response', async () => {
    await writeSse(
      response as unknown as Response,
      eventsOf([
        { type: 'tool', name: 'find_documents' },
        { type: 'delta', text: 'Hola' },
        { type: 'done' },
      ]),
      new AbortController().signal,
    );

    expect(response.status).toBe(200);
    expect(response.headers['Content-Type']).toBe(
      'text/event-stream; charset=utf-8',
    );
    expect(response.body).toBe(
      'event: tool\ndata: {"name":"find_documents"}\n\n' +
        'event: delta\ndata: {"text":"Hola"}\n\n' +
        'event: done\ndata: {}\n\n',
    );
    expect(response.writableEnded).toBe(true);
  });

  it('sends a user-safe error event when the answer fails', async () => {
    await writeSse(
      response as unknown as Response,
      eventsOf([], new Error('OpenAI 500: internal details')),
      new AbortController().signal,
    );

    expect(response.body).toBe(
      `event: error\ndata: {"message":"${ANSWER_FAILED_MESSAGE}"}\n\n`,
    );
    expect(response.body).not.toContain('internal details');
    expect(response.writableEnded).toBe(true);
  });

  it('does not write an error after the client disconnected', async () => {
    const controller = new AbortController();
    controller.abort();

    await writeSse(
      response as unknown as Response,
      eventsOf([], new Error('aborted')),
      controller.signal,
    );

    expect(response.body).toBe('');
  });

  it('aborts when the client closes the connection early', () => {
    const signal = abortOnClientDisconnect(response as unknown as Response);

    response.emit('close');

    expect(signal.aborted).toBe(true);
  });

  it('does not abort when the response already finished', () => {
    const signal = abortOnClientDisconnect(response as unknown as Response);

    response.end();
    response.emit('close');

    expect(signal.aborted).toBe(false);
  });
});
