import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { MoneyFormatInterceptor } from './common/money-format.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new MoneyFormatInterceptor());
  app.enableShutdownHooks();
  const port = app.get(ConfigService).get<number>('PORT') ?? 4000;
  await app.listen(port);
  console.log(`Brightloop API on http://localhost:${port}`);
}
bootstrap();
