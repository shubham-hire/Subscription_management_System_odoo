import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Calendar } from 'lucide-react';
import { getSubscriptions } from '@/api/domain';
import type { Subscription, SubscriptionStatus } from '@/types';
import { formatDate } from '@/lib/dates';
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
import { CreateSubscriptionModal } from './CreateSubscriptionModal';
import { SubscriptionDetailModal } from './SubscriptionDetailModal';

const STATUS_TABS: Array<{ label: string; value: SubscriptionStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Quotation', value: 'quotation' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Closed', value: 'closed' },
];

export function SubscriptionsPage() {
  const [page, setPage] = useState(1);
  const [statusTab, setStatusTab] = useState<SubscriptionStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const pageSize = 15;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['subscriptions', page, statusTab, search],
    queryFn: () =>
      getSubscriptions({
        page,
        page_size: pageSize,
        status: statusTab === 'all' ? undefined : statusTab,
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
        title="Subscriptions"
        description="Monitor active contracts, turn draft quotations into confirmed accounts, and track lifecycle transitions."
        actions={
          <Button onClick={() => setIsCreateOpen(true)} variant="primary">
            <Plus className="h-4 w-4" />
            New Subscription
          </Button>
        }
      />

      {/* ─── Status Filter Tabs & Search ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        {/* Horizontal tabs */}
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

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 sm:w-80">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Filter by contract # or customer..."
              className="pl-9 text-caption"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setSearchInput('');
                setPage(1);
              }}
            >
              Clear
            </Button>
          )}
        </form>
      </div>

      {/* ─── Subscriptions Table ─── */}
      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Contract #</TableHeader>
              <TableHeader>Customer</TableHeader>
              <TableHeader>Plan</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Next Billing Date</TableHeader>
              <TableHeader>Payment Terms</TableHeader>
              <TableHeader>Lines</TableHeader>
              <TableHeader className="text-right">Action</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && <TableSkeleton columns={8} rows={8} />}

            {isError && (
              <TableError
                columns={8}
                message={error instanceof Error ? error.message : 'Failed to load subscriptions.'}
                onRetry={() => refetch()}
              />
            )}

            {!isLoading && !isError && data?.items.length === 0 && (
              <TableEmpty
                columns={8}
                title={
                  statusTab !== 'all' || search
                    ? 'No matching subscriptions'
                    : 'No subscriptions recorded'
                }
                description={
                  statusTab !== 'all' || search
                    ? 'Try adjusting your status filter or clearing search keywords.'
                    : 'Create your first subscription quotation to get started.'
                }
                action={
                  <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Create Subscription
                  </Button>
                }
              />
            )}

            {!isLoading &&
              !isError &&
              data?.items.map((sub) => (
                <TableRow
                  key={sub.id}
                  className="cursor-pointer hover:bg-white/[0.03] transition-colors"
                  onClick={() => setSelectedSub(sub)}
                >
                  <TableCell>
                    <span className="font-mono text-body font-semibold text-zinc-100 block">
                      {sub.number}
                    </span>
                    <span className="text-caption text-zinc-500">
                      Started {formatDate(sub.start_date)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-zinc-200">
                      {sub.customer_name ?? sub.customer_id}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-zinc-300 font-medium">{sub.plan_name ?? '—'}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={sub.status} />
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-zinc-300 tnum">
                      <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                      {formatDate(sub.next_billing_date)}
                    </span>
                  </TableCell>
                  <TableCell className="capitalize text-zinc-400">
                    {sub.payment_terms.replace('_', ' ')}
                  </TableCell>
                  <TableCell className="text-zinc-400 tnum">
                    {sub.lines.length} {sub.lines.length === 1 ? 'item' : 'items'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSub(sub);
                      }}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
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

      {/* ─── Detail Modal ─── */}
      {selectedSub && (
        <SubscriptionDetailModal
          subscription={selectedSub}
          onClose={() => setSelectedSub(null)}
          onUpdated={() => {
            refetch();
            setSelectedSub(null);
          }}
        />
      )}

      {/* ─── Create Modal ─── */}
      <CreateSubscriptionModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => refetch()}
      />
    </div>
  );
}
