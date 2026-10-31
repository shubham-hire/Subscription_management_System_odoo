import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PaymentsService } from '../payments/payments.service';

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, PaymentsService],
  exports: [PaymentsService],
})
export class InvoicesModule {}
