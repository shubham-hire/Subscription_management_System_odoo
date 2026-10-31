import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma.service';
import { CreateUserDto, UserListQueryDto, paginated } from './user.dto';

const SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  customerId: true,
  createdAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  list(q: UserListQueryDto) {
    const page = q.page ?? 1;
    const pageSize = Math.min(q.page_size ?? 20, 100);
    const where = q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: 'insensitive' as const } },
            { email: { contains: q.search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    return this.prisma.$transaction([
      this.prisma.user.findMany({ where, select: SELECT, orderBy: { id: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.user.count({ where }),
    ]).then(([items, total]) => paginated(items, total, page, pageSize));
  }

  /** AUTH-08: admin creates staff/admin accounts. Password stored hashed, never returned. */
  async create(dto: CreateUserDto) {
    const email = dto.email;
    const existing = await this.prisma.user.findFirst({ where: { email } });
    if (existing) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Email is already in use',
        fields: { email: 'Already in use' },
      });
    }
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        role: dto.role ?? 'staff',
      },
      select: SELECT,
    });
    return user;
  }

  /** AUTH-11: deactivate/reactivate without deleting history. */
  async update(id: number, dto: { name?: string; is_active?: boolean }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.is_active !== undefined ? { isActive: dto.is_active } : {}),
      },
      select: SELECT,
    });
  }
}
