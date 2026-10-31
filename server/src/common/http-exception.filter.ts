import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

export class ApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

/**
 * Every error response follows docs/api-contract.md:
 * { "error": { "code": "...", "message": "...", "fields": { ... } } }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiError = { code: 'INTERNAL', message: 'Unexpected server error' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse() as Record<string, unknown>;
      body = {
        code: payload['code'] as string ?? defaultCode(status),
        message: (payload['message'] as string) ?? exception.message,
      };
      // class-validator style: { message: string[], ... } -> fields map
      if (Array.isArray(payload['message'])) {
        body.fields = fieldsFromValidation(payload as { message: string[] });
        body.message = 'Validation failed';
        body.code = 'VALIDATION_ERROR';
      } else if (payload['fields']) {
        body.fields = payload['fields'] as Record<string, string>;
      }
    } else if ((exception as { code?: string })?.['code'] === 'P2002') {
      // Prisma unique-constraint violation — checked by shape so the filter
      // compiles before `prisma generate` has run.
      status = HttpStatus.CONFLICT;
      body = { code: 'CONFLICT', message: 'A record with this value already exists' };
    } else {
      // Unhandled: log the full exception — these must never be silent.
      console.error('[unhandled]', exception);
    }

    res.status(status).json({ error: body });
  }
}

function defaultCode(status: number): string {
  switch (status) {
    case HttpStatus.UNAUTHORIZED: return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN: return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND: return 'NOT_FOUND';
    case HttpStatus.CONFLICT: return 'CONFLICT';
    case HttpStatus.BAD_REQUEST: return 'VALIDATION_ERROR';
    default: return 'INTERNAL';
  }
}

function fieldsFromValidation(payload: { message: string[] }): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const msg of payload.message ?? []) {
    // class-validator messages look like "email must be an email"
    const field = msg.split(' ')[0];
    if (field && !fields[field]) fields[field] = msg;
  }
  return fields;
}
