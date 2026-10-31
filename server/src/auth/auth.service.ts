import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma.service';
import type { JwtPayload } from '../common/jwt-payload';
import { LoginDto, SignupDto, passwordRule } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  /** AUTH-01/02/03/04 + CUS-02 (signup links to an existing customer record by email). */
  async signup(dto: SignupDto) {
    const ruleMsg = passwordRule(dto.password);
    if (ruleMsg) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: ruleMsg, fields: { password: ruleMsg } });
    }
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findFirst({ where: { email } });
    if (existingUser) {
      const msg = 'Email is already in use';
      throw new ConflictException({ code: 'CONFLICT', message: msg, fields: { email: msg } });
    }

    const customer = await this.prisma.customer.findUnique({ where: { email } });
    const result = await this.prisma.$transaction(async (tx) => {
      const customerRecord =
        customer ??
        (await tx.customer.create({ data: { name: dto.name, email } }));
      const user = await tx.user.create({
        data: {
          name: dto.name.trim(),
          email,
          passwordHash: await bcrypt.hash(dto.password, 10),
          role: 'customer',
          customerId: customerRecord.id,
        },
      });
      return user;
    });

    return this.issueToken(result.id, 'customer', result.customerId);
  }

  /** AUTH-05 + AUTH-11 (deactivated users cannot log in). Email is case-insensitive. */
  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({ where: { email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) throw new UnauthorizedException('This account has been deactivated');
    return this.issueToken(user.id, user.role, user.customerId);
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, customerId: true, isActive: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException();
    const { isActive: _isActive, ...rest } = user;
    return rest;
  }

  private async issueToken(id: number, role: 'admin' | 'staff' | 'customer', customerId: number | null) {
    const payload: JwtPayload = { sub: id, role, customerId };
    const token = await this.jwt.signAsync(payload, { expiresIn: '24h' });
    return {
      token,
      access_token: token,
      user: { id, role, customerId },
    };
  }
}
