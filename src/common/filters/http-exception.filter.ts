import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

interface ErrorDetails {
  statusCode: number;
  error: string;
  message: string | string[];
}

const INTERNAL_ERROR: ErrorDetails = {
  statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  error: 'Internal Server Error',
  message: 'Internal server error',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const details = this.toErrorDetails(exception, request);

    const body: ErrorResponseBody = {
      ...details,
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(details.statusCode).json(body);
  }

  private toErrorDetails(exception: unknown, request: Request): ErrorDetails {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }
    this.logger.error(
      { event: 'request.failed', method: request.method, path: request.url },
      exception instanceof Error ? exception.stack : String(exception),
    );
    return INTERNAL_ERROR;
  }

  private fromHttpException(exception: HttpException): ErrorDetails {
    const statusCode = exception.getStatus();
    const payload = exception.getResponse();
    if (typeof payload === 'string') {
      return { statusCode, error: exception.name, message: payload };
    }
    const { error, message } = payload as Partial<ErrorDetails>;
    return {
      statusCode,
      error: error ?? exception.name,
      message: message ?? exception.message,
    };
  }
}
