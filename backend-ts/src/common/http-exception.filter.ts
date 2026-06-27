/**
 * Global exception filter that reshapes every error response to FastAPI's
 * `{ "detail": "<message>" }` form. The Expo frontend reads `data.detail`
 * (see frontend/src/api.ts), so this contract MUST be preserved.
 *
 * It also logs every failure with request context (method, url, correlation id):
 *   - 5xx / unknown errors  -> `error` with stack trace
 *   - 4xx client errors     -> `warn` (one line, no stack)
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      detail = extractDetail(exception.getResponse());
    } else if (exception instanceof Error) {
      detail = exception.message || detail;
    }

    // Request context for the log line (reqId is set by pino-http).
    const reqId = (request as any)?.id;
    const where = `${request?.method} ${request?.originalUrl || request?.url}`;
    const meta = reqId ? `${where} [${reqId}]` : where;

    if (status >= 500) {
      const stack =
        exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${status} ${meta} - ${detail}`, stack);
    } else {
      this.logger.warn(`${status} ${meta} - ${detail}`);
    }

    response.status(status).json({ detail });
  }
}

function extractDetail(res: string | object): string {
  if (typeof res === 'string') return res;
  const anyRes = res as any;
  const message = anyRes?.message ?? anyRes?.detail ?? anyRes?.error;
  if (Array.isArray(message)) {
    // class-validator returns an array of constraint messages
    return message.join('; ');
  }
  if (typeof message === 'string') return message;
  return 'Error';
}
