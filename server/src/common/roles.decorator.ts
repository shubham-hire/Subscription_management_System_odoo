import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
/** Endpoint-level role gate. Applied by RolesGuard (global). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
