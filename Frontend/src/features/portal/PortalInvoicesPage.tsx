import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Printer,
  AlertTriangle,
} from 'lucide-react';
import Decimal from 'decimal.js';
import { getPortalInvoices } from '@/api/domain';
import type { Invoice } from '@/types';
import { formatDate, todayIST } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import {
  Button,
  Card,
  PageHeader,
  StatusBadge,
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
import { InvoiceDetailModal } from '@/features/invoices/InvoiceDetailModal';

export function PortalInvoicesPage() {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['portal', 'invoices', page],
    queryFn: () => getPortalInvoices({ page, page_size: pageSize }),
  });

  return (
    <div>
      <PageHeader
        title="My Invoices"
        description="Review billing statements, tax breakdowns, and print receipts for your account."
      />

      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Invoice #</TableHeader>
              <TableHeader>Billing Period</TableHeader>
              <TableHeader>Due Date</TableHeader>
              <TableHeader className="text-right">Total Amount</TableHeader>
              <TableHeader className="text-right">Balance Due</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader className="text-right">Print Receipt</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && <TableSkeleton columns={7} rows={4} />}

            {isError && (
              <TableError
                columns={7}
                message={error instanceof Error ? error.message : 'Failed to load your invoices.'}
                onRetry={() => refetch()}
              />
            )}

            {!isLoading && !isError && data?.items.length === 0 && (
              <TableEmpty
                columns={7}
                title="No invoices found"
                description="Your account has no billing invoices generated yet."
              />
            )}

            {!isLoading &&
              !isError &&
              data?.items.map((inv) => {
                const balance = new Decimal(inv.total).minus(new Decimal(inv.amountPaid));
                const isOverdue =
                  inv.status === 'confirmed' &&
                  balance.greaterThan(0) &&
                  inv.dueDate < todayIST();

                return (
                  <TableRow
                    key={inv.id}
                    className="cursor-pointer hover:bg-white/[0.03] transition-colors"
                    onClick={() => setSelectedInvoice(inv)}
                  >
                    <TableCell>
                      <span className="font-mono text-body font-semibold text-zinc-100 block">
                        {inv.number}
                      </span>
                      <span className="text-caption text-zinc-500">
                        Issued {formatDate(inv.issueDate)}
                      </span>
                    </TableCell>
                    <TableCell className="text-caption text-zinc-300 tnum">
                      {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 tnum">
                        {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />}
                        <span className={`text-caption ${isOverdue ? 'text-red-300 font-bold' : 'text-zinc-300'}`}>
                          {formatDate(inv.dueDate)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-zinc-100 font-semibold tnum">
                      {formatMoney(inv.total)}
                    </TableCell>
                    <TableCell className="text-right tnum">
                      <span
                        className={`font-semibold ${
                          balance.greaterThan(0) ? 'text-amber-400' : 'text-zinc-500'
                        }`}
                      >
                        {formatMoney(balance.toFixed(2))}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedInvoice(inv);
                        }}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        View / Print
                      </Button>
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

      {/* ─── Printable Invoice Detail Modal ─── */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onUpdated={() => {
            refetch();
            setSelectedInvoice(null);
          }}
        />
      )}
    </div>
  );
}
