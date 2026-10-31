import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './common/prisma.module';
import { JwtAuthGuard } from './common/jwt.guard';
import { RolesGuard } from './common/roles.guard';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PortalModule } from './portal/portal.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, CatalogModule, InvoicesModule, PortalModule],
  controllers: [AppController],
  providers: [
    // Order matters: JwtAuthGuard authenticates (req.user), RolesGuard authorizes
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
