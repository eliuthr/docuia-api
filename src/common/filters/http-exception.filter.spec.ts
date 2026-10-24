import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter.js';

const REQUEST_PATH = '/documents/123';

function createHost() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ url: REQUEST_PATH, method: 'GET' }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('keeps the status and message of an HttpException', () => {
    const { host, status, json } = createHost();

    filter.catch(new NotFoundException('Document not found'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'Document not found',
        path: REQUEST_PATH,
      }),
    );
  });

  it('keeps validation messages as a list', () => {
    const { host, json } = createHost();
    const messages = ['limit must be an integer'];

    filter.catch(new BadRequestException(messages), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: messages }),
    );
  });

  it('handles an HttpException built from a plain string', () => {
    const { host, json } = createHost();

    filter.catch(new HttpException('Teapot', HttpStatus.I_AM_A_TEAPOT), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 418, message: 'Teapot' }),
    );
  });

  it('hides the details of unknown errors', () => {
    const { host, status, json } = createHost();

    filter.catch(new Error('connection string leaked'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = json.mock.calls[0][0] as Record<string, unknown>;
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('leaked');
  });
});
