import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserListQueryDto } from './user.dto';

/** AUTH-08/11: user administration is admin-only. */
@Controller('users')
@Roles(Role.admin)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  list(@Query() q: UserListQueryDto) {
    return this.users.list(q);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }
}
