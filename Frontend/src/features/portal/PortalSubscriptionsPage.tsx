import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar } from 'lucide-react';
import { getPortalSubscriptions } from '@/api/domain';
import type { Subscription } from '@/types';
import { formatDate } from '@/lib/dates';
import {
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
  Button,
} from '@/components/ui';
import { SubscriptionDetailModal } from '@/features/subscriptions/SubscriptionDetailModal';

export function PortalSubscriptionsPage() {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['portal', 'subscriptions', page],
    queryFn: () => getPortalSubscriptions({ page, page_size: pageSize }),
  });

  return (
    <div>
      <PageHeader
        title="My Subscriptions"
        description="View your active software subscriptions, recurring schedules, and licensed plan tiers."
      />

      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Contract #</TableHeader>
              <TableHeader>Plan Name</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Next Renewal Date</TableHeader>
              <TableHeader>Payment Terms</TableHeader>
              <TableHeader>Items Included</TableHeader>
              <TableHeader className="text-right">Contract Details</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && <TableSkeleton columns={7} rows={4} />}

            {isError && (
              <TableError
                columns={7}
                message={error instanceof Error ? error.message : 'Failed to load your subscriptions.'}
                onRetry={() => refetch()}
              />
            )}

            {!isLoading && !isError && data?.items.length === 0 && (
              <TableEmpty
                columns={7}
                title="No active subscriptions found"
                description="You do not have any contracts linked to your portal account currently."
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
                    <span className="font-medium text-zinc-200">{sub.plan_name ?? '—'}</span>
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
    </div>
  );
}
