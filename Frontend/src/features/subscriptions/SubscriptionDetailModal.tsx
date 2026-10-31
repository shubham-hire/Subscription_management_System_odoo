import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Play,
  Pause,
  XCircle,
  Clock,
  Layers,
} from 'lucide-react';
import { transitionSubscription } from '@/api/domain';
import type { Subscription, SubscriptionAction, SubscriptionStatus } from '@/types';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import {
  Button,
  StatusBadge,
  Dialog,
  useToast,
} from '@/components/ui';

interface SubscriptionDetailModalProps {
  subscription: Subscription;
  onClose: () => void;
  onUpdated?: () => void;
}

const LIFECYCLE_STEPS: SubscriptionStatus[] = ['quotation', 'confirmed', 'active', 'closed'];

export function SubscriptionDetailModal({
  subscription,
  onClose,
  onUpdated,
}: SubscriptionDetailModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const transitionMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: SubscriptionAction }) =>
      transitionSubscription(id, action),
    onSuccess: (updated) => {
      toast('success', `Subscription ${updated.number} moved to ${updated.status}.`);
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      if (onUpdated) onUpdated();
    },
    onError: (err) => {
      toast('error', err instanceof Error ? err.message : 'Status transition failed.');
    },
  });

  const handleAction = (action: SubscriptionAction) => {
    transitionMutation.mutate({ id: subscription.id, action });
  };

  // Determine current lifecycle step index
  const currentStepIdx = LIFECYCLE_STEPS.indexOf(subscription.status);

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title={`Subscription ${subscription.number}`}
      description={`Customer Contract · ${subscription.plan?.name ?? 'Plan'}`}
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Status Stepper */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-caption font-semibold text-zinc-400 uppercase tracking-wider">
              Lifecycle Stage
            </span>
            <StatusBadge status={subscription.status} />
          </div>

          <div className="flex items-center justify-between relative">
            <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-0.5 bg-white/[0.08] -z-0" />
            {LIFECYCLE_STEPS.map((step, idx) => {
              const isPast = currentStepIdx >= 0 && currentStepIdx > idx;
              const isCurrent = subscription.status === step;

              return (
                <div key={step} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`
                      h-7 w-7 rounded-full flex items-center justify-center text-caption font-semibold transition-all duration-200
                      ${
                        isCurrent
                          ? 'bg-primary-500 text-white shadow-glow ring-4 ring-primary-500/20'
                          : isPast
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-surface-900 border border-white/[0.1] text-zinc-600'
                      }
                    `}
                  >
                    {isPast ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                  </div>
                  <span
                    className={`mt-1.5 text-caption font-medium capitalize ${
                      isCurrent ? 'text-primary-300 font-semibold' : isPast ? 'text-zinc-300' : 'text-zinc-600'
                    }`}
                  >
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-primary-500/[0.03] border border-primary-500/20">
          <div>
            <span className="text-caption text-zinc-400 block">Available Lifecycle Actions</span>
            <span className="text-body text-zinc-200 font-medium">
              {subscription.status === 'quotation' && 'Ready for customer order confirmation'}
              {subscription.status === 'confirmed' && 'Confirmed contract ready for service activation'}
              {subscription.status === 'active' && 'Currently recurring and eligible for automated billing'}
              {subscription.status === 'paused' && 'Service temporarily held — resume when ready'}
              {subscription.status === 'closed' && 'Contract terminated. Invoices remain archived.'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {subscription.status === 'quotation' && (
              <Button
                variant="primary"
                size="sm"
                loading={transitionMutation.isPending}
                onClick={() => handleAction('confirm')}
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirm Quotation
              </Button>
            )}

            {subscription.status === 'confirmed' && (
              <Button
                variant="success"
                size="sm"
                loading={transitionMutation.isPending}
                onClick={() => handleAction('activate')}
              >
                <Play className="h-4 w-4" />
                Activate Subscription
              </Button>
            )}

            {subscription.status === 'active' && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={transitionMutation.isPending}
                  onClick={() => handleAction('pause')}
                >
                  <Pause className="h-4 w-4" />
                  Pause
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  loading={transitionMutation.isPending}
                  onClick={() => handleAction('close')}
                >
                  <XCircle className="h-4 w-4" />
                  Close Contract
                </Button>
              </>
            )}

            {subscription.status === 'paused' && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  loading={transitionMutation.isPending}
                  onClick={() => handleAction('resume')}
                >
                  <Play className="h-4 w-4" />
                  Resume
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  loading={transitionMutation.isPending}
                  onClick={() => handleAction('close')}
                >
                  <XCircle className="h-4 w-4" />
                  Close Contract
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Contract Meta Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="space-y-1">
            <span className="text-caption text-zinc-500 uppercase tracking-wider block">Customer</span>
            <span className="text-body font-medium text-zinc-200 block truncate">
              {subscription.customer?.name ?? subscription.customerId}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-caption text-zinc-500 uppercase tracking-wider block">Plan</span>
            <span className="text-body font-medium text-zinc-200 block">
              {subscription.plan?.name ?? '—'}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-caption text-zinc-500 uppercase tracking-wider block">Payment Terms</span>
            <span className="text-body font-medium text-zinc-200 capitalize">
              {subscription.paymentTermsDays === 0 ? 'Immediate' : `Net ${subscription.paymentTermsDays}`}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-caption text-zinc-500 uppercase tracking-wider block">Next Billing</span>
            <span className="text-body font-medium text-primary-300 tnum">
              {formatDate(subscription.nextBillingDate)}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-caption text-zinc-500 uppercase tracking-wider block">Start Date</span>
            <span className="text-body text-zinc-300 tnum">{formatDate(subscription.startDate)}</span>
          </div>

          <div className="space-y-1">
            <span className="text-caption text-zinc-500 uppercase tracking-wider block">Expiry Date</span>
            <span className="text-body text-zinc-300 tnum">{formatDate(subscription.expiryDate)}</span>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <span className="text-caption text-zinc-500 uppercase tracking-wider block">Contract Number</span>
            <span className="text-body font-mono text-zinc-200 font-semibold">{subscription.number}</span>
          </div>
        </div>

        {/* Line Items Table */}
        <div>
          <h4 className="text-subheading text-zinc-100 mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary-400" />
            Configured Contract Lines ({subscription.lines.length})
          </h4>

          <div className="rounded-xl border border-white/[0.07] overflow-hidden">
            <table className="w-full text-body text-left tnum">
              <thead>
                <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                  <th className="px-4 py-3 text-caption font-semibold text-zinc-500 uppercase">Product</th>
                  <th className="px-3 py-3 text-caption font-semibold text-zinc-500 uppercase">Variant</th>
                  <th className="px-3 py-3 text-caption font-semibold text-zinc-500 uppercase text-center">Qty</th>
                  <th className="px-3 py-3 text-caption font-semibold text-zinc-500 uppercase text-right">Unit Price</th>
                  <th className="px-4 py-3 text-caption font-semibold text-zinc-500 uppercase text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {subscription.lines.map((l) => {
                  const lineTotal = Number(l.unitPrice) * l.quantity;
                  return (
                    <tr key={l.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-zinc-200 font-medium">{l.product?.name ?? l.productId}</td>
                      <td className="px-3 py-3">
                        {l.variantId ? (
                          <span className="px-2 py-0.5 rounded-full bg-primary-500/10 border border-primary-500/25 text-caption font-medium text-primary-300">
                            {l.product?.variants?.find((v) => v.id === l.variantId)?.value}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center text-zinc-300">{l.quantity}</td>
                      <td className="px-3 py-3 text-right text-zinc-300">{formatMoney(l.unitPrice)}</td>
                      <td className="px-4 py-3 text-right text-zinc-100 font-semibold">
                        {formatMoney(lineTotal.toFixed(2))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lifecycle Status History Timeline */}
        <div>
          <h4 className="text-subheading text-zinc-100 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-400" />
            Audit History & Status Transitions
          </h4>

          {(subscription.history ?? []).length === 0 ? (
            <p className="text-caption text-zinc-500">No transition history recorded.</p>
          ) : (
            <div className="space-y-2 border-l-2 border-white/[0.08] ml-2 pl-4 py-1">
              {(subscription.history ?? []).map((h, i) => (
                <div key={h.id || i} className="relative flex items-center justify-between text-caption py-1">
                  <div className="absolute -left-[21px] top-2 h-2.5 w-2.5 rounded-full bg-primary-400 ring-4 ring-surface-950" />
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-200 capitalize">
                      {h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : h.toStatus}
                    </span>
                    <span className="text-zinc-500">by {h.changedBy}</span>
                  </div>
                  <span className="text-zinc-500 tnum">{formatDate(h.changedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-white/[0.08]">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
