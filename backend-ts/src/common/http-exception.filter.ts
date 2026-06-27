/**
 * Global exception filter that reshapes every error response to FastAPI's
 * `{ "detail": "<message>" }` form. The Expo frontend reads `data.detail`
 * (see frontend/src/api.ts), so this contract MUST be preserved.
 *
 * - HttpException (incl. our `throw new HttpException(msg, status)`): use its
 *   message/status. If the body is the class-validator array, join it.
 * - Anything else: 500 with a generic detail (and log the stack).
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      detail = extractDetail(res);
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      detail = exception.message || detail;
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
