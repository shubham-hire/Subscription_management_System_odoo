import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: number;
  role: Role;
  customerId: number | null;
}
