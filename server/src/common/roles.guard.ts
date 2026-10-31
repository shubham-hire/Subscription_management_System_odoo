import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';

export interface RequestUser {
  id: number;
  role: Role;
  customerId: number | null;
}

declare module 'express' {
  interface Request {
    user?: RequestUser;
  }
}

/**
 * Global guard: JWT presence check + role check via @Roles().
 * Routes marked @Public() skip both. Enforced on the backend for every
 * endpoint (PRD §2.2) — hiding menus is never the security boundary.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user: RequestUser | undefined = request.user;
    if (!user) return false; // JwtStrategy populates this; no user = no valid token

    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    return required.includes(user.role);
  }
}
