import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
  requestId?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        const body = response as Record<string, unknown>;
        message = (body.message as string | string[]) ?? exception.message;
        error = (body.error as string) ?? exception.name;
      }
      error = error === 'InternalServerError' ? exception.name : error;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Translate the handful of Prisma codes that map to real HTTP semantics.
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          error = 'Conflict';
          message = `A record with that ${(exception.meta?.target as string[])?.join(', ') ?? 'value'} already exists`;
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          error = 'NotFound';
          message = 'The requested record does not exist';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          error = 'BadRequest';
          message = 'Related record not found';
          break;
        default:
          error = 'DatabaseError';
          message = 'A database error occurred';
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.originalUrl} -> ${status}: ${Array.isArray(message) ? message.join('; ') : message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${req.method} ${req.originalUrl} -> ${status}: ${Array.isArray(message) ? message[0] : message}`);
    }

    const body: ErrorBody = {
      statusCode: status,
      error,
      message,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    };

    res.status(status).json(body);
  }
}
