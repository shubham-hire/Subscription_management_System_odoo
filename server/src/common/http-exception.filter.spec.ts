/**
 * Unit tests for the global exception filter — the one component every error
 * response passes through. Verifies the docs/api-contract.md error shape is
 * produced for every branch: Nest exceptions, class-validator payloads,
 * Prisma unique violations, and unhandled errors.
 */
import { describe, expect, it, vi, beforeEach, type MockInstance } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
  type ArgumentsHost,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function makeHost() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({}) }),
  } as unknown as ArgumentsHost;
  return { res, host };
}

describe('HttpExceptionFilter — contract error shape', () => {
  let filter: HttpExceptionFilter;
  let consoleSpy: MockInstance;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it.each([
    ['NotFoundException', () => new NotFoundException('Invoice not found'), 404, 'NOT_FOUND'],
    ['UnauthorizedException', () => new UnauthorizedException(), 401, 'UNAUTHORIZED'],
    ['ForbiddenException', () => new ForbiddenException('nope'), 403, 'FORBIDDEN'],
    ['ConflictException', () => new ConflictException('dup'), 409, 'CONFLICT'],
  ])('maps %s to its contract code', (_name, make, status, code) => {
    const { res, host } = makeHost();
    filter.catch(make(), host);
    expect(res.status).toHaveBeenCalledWith(status);
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe(code);
    expect(body.error.message).toBeTruthy();
  });

  it('preserves an explicit code/message/fields payload', () => {
    const { res, host } = makeHost();
    filter.catch(
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Bad input',
        fields: { email: 'Already in use' },
      }),
      host,
    );
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'VALIDATION_ERROR', message: 'Bad input', fields: { email: 'Already in use' } },
    });
  });

  it('converts class-validator arrays into a fields map (first message per field wins)', () => {
    const { res, host } = makeHost();
    filter.catch(
      new BadRequestException({
        message: ['email must be a valid email', 'email is already in use', 'name is required'],
      }),
      host,
    );
    const body = res.json.mock.calls[0][0].error;
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('Validation failed');
    expect(body.fields).toEqual({
      email: 'email must be a valid email',
      name: 'name is required',
    });
  });

  it('maps a Prisma P2002 (unique violation) by shape to 409 CONFLICT', () => {
    const { res, host } = makeHost();
    const prismaError = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    filter.catch(prismaError, host);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'CONFLICT', message: 'A record with this value already exists' },
    });
  });

  it('turns unhandled errors into a generic 500 and logs them (never silent)', () => {
    const { res, host } = makeHost();
    filter.catch(new Error('boom'), host);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL', message: 'Unexpected server error' },
    });
    expect(consoleSpy).toHaveBeenCalledWith('[unhandled]', expect.any(Error));
  });

  it('passes through the message of plain HttpExceptions', () => {
    const { res, host } = makeHost();
    filter.catch(new HttpException('custom', 418), host);
    expect(res.status).toHaveBeenCalledWith(418);
    expect(res.json.mock.calls[0][0].error.message).toBe('custom');
  });
});
