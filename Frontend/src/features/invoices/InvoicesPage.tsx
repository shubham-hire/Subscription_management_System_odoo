import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Zap,
  Search,
  AlertTriangle,
} from 'lucide-react';
import Decimal from 'decimal.js';
import { getInvoices } from '@/api/domain';
import type { Invoice, InvoiceStatus } from '@/types';
import { formatDate, todayIST } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import {
  Button,
  Card,
  Input,
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
import { RunBillingModal } from './RunBillingModal';
import { InvoiceDetailModal } from './InvoiceDetailModal';
import { RecordPaymentModal } from '@/features/payments/RecordPaymentModal';

const STATUS_TABS: Array<{ label: string; value: InvoiceStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Paid', value: 'paid' },
  { label: 'Draft', value: 'draft' },
  { label: 'Cancelled', value: 'cancelled' },
];

export function InvoicesPage() {
  const [page, setPage] = useState(1);
  const [statusTab, setStatusTab] = useState<InvoiceStatus | 'all'>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const pageSize = 15;

  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['invoices', page, statusTab, overdueOnly, search],
    queryFn: () =>
      getInvoices({
        page,
        page_size: pageSize,
        status: statusTab === 'all' ? undefined : statusTab,
        overdue: overdueOnly || undefined,
        search: search || undefined,
      }),
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Automated billing ledgers, tax breakdown, settlement status, and overdue accounts."
        actions={
          <Button
            onClick={() => setIsBillingModalOpen(true)}
            variant="primary"
            className="shadow-glow"
          >
            <Zap className="h-4 w-4" />
            Run Billing Now
          </Button>
        }
      />

      {/* ─── Status Filter Tabs & Overdue Switch ─── */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.07] overflow-x-auto">
            {STATUS_TABS.map((tab) => {
              const isActive = statusTab === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => {
                    setStatusTab(tab.value);
                    setPage(1);
                  }}
                  className={`
                    px-3.5 py-1.5 rounded-lg text-caption font-medium transition-all duration-150 select-none whitespace-nowrap
                    ${
                      isActive
                        ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30 shadow-glow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
                    }
                  `}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Overdue filter toggle */}
          <button
            onClick={() => {
              setOverdueOnly((prev) => !prev);
              setPage(1);
            }}
            className={`
              flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-caption font-medium transition-all duration-150 select-none
              ${
                overdueOnly
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30 shadow-glow-red'
                  : 'bg-white/[0.03] border border-white/[0.07] text-zinc-400 hover:text-zinc-200'
              }
            `}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            Overdue Only
          </button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 sm:w-80">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Filter by invoice #, customer..."
              className="pl-9 text-caption"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
          {(search || overdueOnly) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setSearchInput('');
                setOverdueOnly(false);
                setPage(1);
              }}
            >
              Reset
            </Button>
          )}
        </form>
      </div>

      {/* ─── Invoices Table ─── */}
      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Invoice #</TableHeader>
              <TableHeader>Customer</TableHeader>
              <TableHeader>Contract</TableHeader>
              <TableHeader>Billing Period</TableHeader>
              <TableHeader>Due Date</TableHeader>
              <TableHeader className="text-right">Total Amount</TableHeader>
              <TableHeader className="text-right">Balance Due</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader className="text-right">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && <TableSkeleton columns={9} rows={8} />}

            {isError && (
              <TableError
                columns={9}
                message={error instanceof Error ? error.message : 'Failed to load invoices.'}
                onRetry={() => refetch()}
              />
            )}

            {!isLoading && !isError && data?.items.length === 0 && (
              <TableEmpty
                columns={9}
                title={
                  overdueOnly
                    ? 'No overdue invoices'
                    : statusTab !== 'all' || search
                    ? 'No matching invoices'
                    : 'No invoices generated yet'
                }
                description={
                  overdueOnly
                    ? 'Great news! All confirmed invoices with a balance are within their payment terms.'
                    : 'Click "Run Billing Now" to generate invoices for active subscriptions.'
                }
                action={
                  <Button variant="primary" size="sm" onClick={() => setIsBillingModalOpen(true)}>
                    <Zap className="h-4 w-4" />
                    Run Billing Now
                  </Button>
                }
              />
            )}

            {!isLoading &&
              !isError &&
              data?.items.map((inv) => {
                const balance = new Decimal(inv.total).minus(new Decimal(inv.amount_paid));
                const isOverdue =
                  inv.status === 'confirmed' &&
                  balance.greaterThan(0) &&
                  inv.due_date < todayIST();

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
                        Issued {formatDate(inv.issue_date)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-zinc-200">
                        {inv.customer_name ?? inv.customer_id}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-caption font-mono text-zinc-400">
                        {inv.subscription_number ?? inv.subscription_id}
                      </span>
                    </TableCell>
                    <TableCell className="text-caption text-zinc-400 tnum">
                      {formatDate(inv.period_start)} – {formatDate(inv.period_end)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 tnum">
                        {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />}
                        <span className={`text-caption ${isOverdue ? 'text-red-300 font-bold' : 'text-zinc-300'}`}>
                          {formatDate(inv.due_date)}
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
                      <div className="flex items-center justify-end gap-1.5">
                        {inv.status === 'confirmed' && balance.greaterThan(0) && (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPayingInvoice(inv);
                            }}
                          >
                            Pay
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInvoice(inv);
                          }}
                        >
                          View
                        </Button>
                      </div>
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

      {/* ─── Run Billing Modal ─── */}
      <RunBillingModal
        open={isBillingModalOpen}
        onClose={() => setIsBillingModalOpen(false)}
        onCompleted={() => refetch()}
      />

      {/* ─── Invoice Detail Modal ─── */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onRecordPayment={(inv) => setPayingInvoice(inv)}
          onUpdated={() => {
            refetch();
            setSelectedInvoice(null);
          }}
        />
      )}

      {/* ─── Record Payment Modal ─── */}
      {payingInvoice && (
        <RecordPaymentModal
          open={true}
          preselectedInvoice={payingInvoice}
          onClose={() => setPayingInvoice(null)}
          onRecorded={() => {
            refetch();
            setPayingInvoice(null);
          }}
        />
      )}
    </div>
  );
}
