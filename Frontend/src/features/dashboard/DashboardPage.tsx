import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  IndianRupee,
  Clock3,
  AlertTriangle,
  ArrowUpRight,
  Mail,
  Phone,
} from 'lucide-react';
import { getReportSummary, getOverdueInvoices } from '@/api/domain';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';

export function DashboardPage() {
  const summaryQuery = useQuery({ queryKey: ['reports', 'summary'], queryFn: getReportSummary });
  const overdueQuery = useQuery({ queryKey: ['reports', 'overdue'], queryFn: getOverdueInvoices });

  const summary = summaryQuery.data;
  const overdue = overdueQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="The finance lead's questions, answered in one screen — active subscriptions, revenue, outstanding and overdue."
      />

      {/* ─── KPI cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <KpiCard
          index={0}
          loading={summaryQuery.isLoading}
          label="Active Subscriptions"
          value={summary ? String(summary.active_subscriptions) : ''}
          hint="recurring right now"
          icon={<Activity className="h-4 w-4 text-emerald-400" />}
          accent="emerald"
        />
        <KpiCard
          index={1}
          loading={summaryQuery.isLoading}
          label="Revenue Collected"
          value={summary ? formatMoney(summary.revenue_collected) : ''}
          hint="all recorded payments"
          icon={<IndianRupee className="h-4 w-4 text-primary-400" />}
          accent="primary"
        />
        <KpiCard
          index={2}
          loading={summaryQuery.isLoading}
          label="Outstanding"
          value={summary ? formatMoney(summary.outstanding) : ''}
          hint="confirmed, not yet paid"
          icon={<Clock3 className="h-4 w-4 text-amber-400" />}
          accent="amber"
        />
        <KpiCard
          index={3}
          loading={summaryQuery.isLoading}
          label="Overdue"
          value={summary ? String(summary.overdue_count) : ''}
          sub={summary ? formatMoney(summary.overdue_amount) : ''}
          hint="past due with balance"
          icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
          accent="red"
        />
      </div>

      {/* ─── Overdue list ─── */}
      <section
        className="glass glass-edge shadow-card overflow-hidden animate-fade-up"
        style={{ animationDelay: '160ms' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-subheading text-zinc-100">Overdue invoices</h2>
            <p className="mt-0.5 text-caption text-zinc-500">
              Sorted by days overdue — chase the top of this list first
            </p>
          </div>
          <Link
            to="/app/invoices?overdue=true"
            className="inline-flex items-center gap-1 text-caption font-medium text-primary-400 hover:text-primary-300 transition-colors"
          >
            View in invoices
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {overdueQuery.isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 skeleton" style={{ opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        ) : overdue.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shadow-glow-green">
              <Activity className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-body text-zinc-300 font-medium">Nothing overdue</p>
            <p className="mt-1 text-caption text-zinc-500">
              Every confirmed invoice with a balance is still within its due date.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body text-left tnum">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="px-6 py-3 text-caption font-semibold text-zinc-500 uppercase tracking-wider">Invoice</th>
                  <th className="px-4 py-3 text-caption font-semibold text-zinc-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-caption font-semibold text-zinc-500 uppercase tracking-wider">Due date</th>
                  <th className="px-4 py-3 text-caption font-semibold text-zinc-500 uppercase tracking-wider">Balance</th>
                  <th className="px-4 py-3 text-caption font-semibold text-zinc-500 uppercase tracking-wider">Days overdue</th>
                  <th className="px-6 py-3 text-caption font-semibold text-zinc-500 uppercase tracking-wider">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {overdue.slice(0, 10).map((inv) => (
                  <tr key={inv.id} className="transition-colors duration-100 hover:bg-white/[0.03]">
                    <td className="px-6 py-3">
                      <Link
                        to={`/app/invoices/${inv.id}`}
                        className="font-medium text-primary-400 hover:text-primary-300 transition-colors"
                      >
                        {inv.number}
                      </Link>
                      <div className="text-caption text-zinc-600">{inv.subscription_number}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-200">{inv.customer_name}</td>
                    <td className="px-4 py-3 text-zinc-400">{formatDate(inv.due_date)}</td>
                    <td className="px-4 py-3 font-medium text-zinc-100">
                      {formatMoney(invoiceBalance(inv))}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-red-500/10 border border-red-500/25 px-2 py-0.5 text-caption font-medium text-red-300">
                        {inv.days_overdue} {inv.days_overdue === 1 ? 'day' : 'days'}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col gap-0.5 text-caption text-zinc-500">
                        {inv.customer_email && (
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="h-3 w-3" /> {inv.customer_email}
                          </span>
                        )}
                        {inv.customer_phone && (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="h-3 w-3" /> {inv.customer_phone}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {overdue.length > 10 && (
              <div className="px-6 py-3 border-t border-white/[0.06] text-caption text-zinc-500">
                Showing top 10 of {overdue.length} overdue invoices
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function invoiceBalance(inv: { total: string; amount_paid: string }): string {
  const balance = parseFloat(inv.total) - parseFloat(inv.amount_paid);
  return balance.toFixed(2);
}

// ─── KPI card ───

const ACCENTS = {
  emerald: 'from-emerald-500/15',
  primary: 'from-primary-500/15',
  amber: 'from-amber-500/15',
  red: 'from-red-500/15',
} as const;

function KpiCard({
  index,
  loading,
  label,
  value,
  sub,
  hint,
  icon,
  accent,
}: {
  index: number;
  loading: boolean;
  label: string;
  value: string;
  sub?: string;
  hint: string;
  icon: React.ReactNode;
  accent: keyof typeof ACCENTS;
}) {
  return (
    <div
      className="glass glass-edge shadow-card p-5 relative overflow-hidden animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Accent wash in the top-left corner */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-8 -left-8 h-32 w-32 rounded-full bg-gradient-to-br ${ACCENTS[accent]} to-transparent blur-2xl`}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <p className="text-caption font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
          <div className="h-7 w-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
        </div>
        {loading ? (
          <div className="h-8 w-28 skeleton" />
        ) : (
          <p className="text-[1.75rem] leading-9 font-semibold text-zinc-100 tnum">
            {value}
            {sub && (
              <span className="ml-2 text-body font-normal text-zinc-500">{sub}</span>
            )}
          </p>
        )}
        <p className="mt-1 text-caption text-zinc-600">{hint}</p>
      </div>
    </div>
  );
}
