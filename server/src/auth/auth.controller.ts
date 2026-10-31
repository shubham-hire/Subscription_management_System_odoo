import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from '../common/roles.guard';
import { Public } from '../common/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto, SignupDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  me(@Req() req: Request & { user: RequestUser }) {
    return this.auth.me(req.user.id);
  }
}
