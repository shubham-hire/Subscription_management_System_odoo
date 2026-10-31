import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { RequestUser } from './roles.guard';
import type { JwtPayload } from './jwt-payload';

/**
 * Stateless bearer-token guard (D7). Verifies the JWT and populates
 * req.user = { id, role, customerId }. Skips @Public() routes.
 * Runs before RolesGuard (APP_GUARD order).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token');
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(header.slice(7));
      const user: RequestUser = { id: payload.sub, role: payload.role, customerId: payload.customerId };
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
