import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * GlobalExceptionFilter implements RFC 7807 Problem JSON format.
 * It catches ALL exceptions and normalizes them into a consistent API error response.
 * Stack traces are never leaked to clients in production.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let errors: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        message = (res.message as string) || message;

        // Handle class-validator array errors
        if (Array.isArray(res.message)) {
          message = 'Validation failed';
          errors = this.buildValidationErrors(res.message as string[]);
        }
      }
    } else if (exception instanceof Error) {
      // Prisma-specific error handling
      if (exception.constructor.name === 'PrismaClientKnownRequestError') {
        const prismaError = exception as any;
        if (prismaError.code === 'P2002') {
          statusCode = HttpStatus.CONFLICT;
          message = `A record with this ${prismaError.meta?.target?.join(', ')} already exists`;
        } else if (prismaError.code === 'P2025') {
          statusCode = HttpStatus.NOT_FOUND;
          message = 'Record not found';
        }
      }

      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        process.env.NODE_ENV !== 'production' ? exception.stack : undefined,
      );
    }

    // Log all 5xx errors
    if (statusCode >= 500) {
      this.logger.error(`${statusCode} ${request.method} ${request.url} — ${message}`);
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private buildValidationErrors(messages: string[]): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    for (const msg of messages) {
      // class-validator format: "fieldName must be..."
      const parts = msg.split(' ');
      const field = parts[0];
      if (!errors[field]) errors[field] = [];
      errors[field].push(msg);
    }
    return errors;
  }
}
