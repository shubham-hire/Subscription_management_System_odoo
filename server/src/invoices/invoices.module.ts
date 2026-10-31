import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PaymentsService } from '../payments/payments.service';
import { PaymentsController } from '../payments/payments.controller';

@Module({
  controllers: [InvoicesController, PaymentsController],
  providers: [InvoicesService, PaymentsService],
  exports: [PaymentsService],
})
export class InvoicesModule {}
