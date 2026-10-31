import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CreditCard,
  Plus,
  Smartphone,
  Landmark,
  Banknote,
  FileCheck,
} from 'lucide-react';
import { getPayments } from '@/api/domain';
import type { Payment } from '@/types';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import {
  Button,
  Card,
  PageHeader,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  TableSkeleton,
  TableEmpty,
  TableError,
  TablePagination,
} from '@/components/ui';
import { RecordPaymentModal } from './RecordPaymentModal';

const METHOD_LABELS: Record<Payment['method'], { label: string; icon: React.ReactNode; color: string }> = {
  upi: {
    label: 'UPI',
    icon: <Smartphone className="h-3.5 w-3.5 text-emerald-400" />,
    color: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
  },
  card: {
    label: 'Card',
    icon: <CreditCard className="h-3.5 w-3.5 text-primary-400" />,
    color: 'bg-primary-500/10 border-primary-500/25 text-primary-300',
  },
  bank_transfer: {
    label: 'Bank Transfer',
    icon: <Landmark className="h-3.5 w-3.5 text-sky-400" />,
    color: 'bg-sky-500/10 border-sky-500/25 text-sky-300',
  },
  cash: {
    label: 'Cash',
    icon: <Banknote className="h-3.5 w-3.5 text-amber-400" />,
    color: 'bg-amber-500/10 border-amber-500/25 text-amber-300',
  },
  cheque: {
    label: 'Cheque',
    icon: <FileCheck className="h-3.5 w-3.5 text-purple-400" />,
    color: 'bg-purple-500/10 border-purple-500/25 text-purple-300',
  },
};

export function PaymentsPage() {
  const [page, setPage] = useState(1);
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const pageSize = 15;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['payments', page],
    queryFn: () => getPayments({ page, page_size: pageSize }),
  });

  const filteredItems = (data?.items ?? []).filter((p) =>
    methodFilter === 'all' ? true : p.method === methodFilter,
  );

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Transactions ledger tracking incoming settlements, payment modes, and invoice allocations."
        actions={
          <Button onClick={() => setIsRecordOpen(true)} variant="primary">
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
        }
      />

      {/* ─── Method Filter Pills ─── */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.07] mb-6 overflow-x-auto w-fit">
        <button
          onClick={() => setMethodFilter('all')}
          className={`
            px-3.5 py-1.5 rounded-lg text-caption font-medium transition-all duration-150 select-none
            ${
              methodFilter === 'all'
                ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30 shadow-glow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
            }
          `}
        >
          All Methods
        </button>
        {Object.entries(METHOD_LABELS).map(([k, meta]) => (
          <button
            key={k}
            onClick={() => setMethodFilter(k)}
            className={`
              flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-caption font-medium transition-all duration-150 select-none
              ${
                methodFilter === k
                  ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30 shadow-glow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
              }
            `}
          >
            {meta.icon}
            {meta.label}
          </button>
        ))}
      </div>

      {/* ─── Payments Table ─── */}
      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Payment ID</TableHeader>
              <TableHeader>Invoice Target</TableHeader>
              <TableHeader>Payment Method</TableHeader>
              <TableHeader>Payment Date</TableHeader>
              <TableHeader className="text-right">Amount Paid</TableHeader>
              <TableHeader>Recorded By</TableHeader>
              <TableHeader>Reference Note</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && <TableSkeleton columns={7} rows={8} />}

            {isError && (
              <TableError
                columns={7}
                message={error instanceof Error ? error.message : 'Failed to load payments.'}
                onRetry={() => refetch()}
              />
            )}

            {!isLoading && !isError && filteredItems.length === 0 && (
              <TableEmpty
                columns={7}
                title={methodFilter !== 'all' ? 'No payments matching method' : 'No payments recorded'}
                description={
                  methodFilter !== 'all'
                    ? `No transactions recorded under payment method "${methodFilter}".`
                    : 'Record customer payments against confirmed invoices to track revenue.'
                }
                action={
                  <Button variant="primary" size="sm" onClick={() => setIsRecordOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Record Payment
                  </Button>
                }
              />
            )}

            {!isLoading &&
              !isError &&
              filteredItems.map((pay) => {
                const meta = METHOD_LABELS[pay.method] ?? {
                  label: pay.method,
                  icon: <CreditCard className="h-3.5 w-3.5" />,
                  color: 'bg-white/[0.05] text-zinc-300',
                };

                return (
                  <TableRow key={pay.id}>
                    <TableCell>
                      <span className="font-mono text-caption text-zinc-400 block">{pay.id}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-body font-semibold text-zinc-100">
                        {pay.invoice_number ?? pay.invoice_id}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-medium border ${meta.color}`}
                      >
                        {meta.icon}
                        {meta.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-zinc-300 tnum text-caption">
                      {formatDate(pay.payment_date)}
                    </TableCell>
                    <TableCell className="text-right text-emerald-400 font-bold text-body tnum">
                      +{formatMoney(pay.amount)}
                    </TableCell>
                    <TableCell className="text-caption text-zinc-400 truncate max-w-[140px]">
                      {pay.recorded_by}
                    </TableCell>
                    <TableCell className="text-caption text-zinc-500 truncate max-w-[200px]">
                      {pay.note || '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>

        {data && data.total > pageSize && (
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={data.total}
            onPageChange={setPage}
          />
        )}
      </Card>

      {/* ─── Record Payment Modal ─── */}
      <RecordPaymentModal
        open={isRecordOpen}
        onClose={() => setIsRecordOpen(false)}
        onRecorded={() => refetch()}
      />
    </div>
  );
}
