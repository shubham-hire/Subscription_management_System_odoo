import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Zap, CheckCircle2, RefreshCw } from 'lucide-react';
import { runBilling } from '@/api/domain';
import type { BillingRunSummary } from '@/types';
import { Button, Dialog, useToast } from '@/components/ui';

interface RunBillingModalProps {
  open: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

export function RunBillingModal({ open, onClose, onCompleted }: RunBillingModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [summary, setSummary] = useState<BillingRunSummary | null>(null);

  const billingMutation = useMutation({
    mutationFn: runBilling,
    onSuccess: (res) => {
      setSummary(res);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      if (res.created > 0) {
        toast('success', `Billing completed: ${res.created} new invoices generated.`);
      } else {
        toast('info', 'Zero new invoices generated — all active subscriptions are up to date.');
      }
      if (onCompleted) onCompleted();
    },
    onError: (err) => {
      toast('error', err instanceof Error ? err.message : 'Billing run failed.');
    },
  });

  const handleRun = () => {
    billingMutation.mutate();
  };

  const handleClose = () => {
    setSummary(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Run Recurring Billing"
      description="Scan all Active subscriptions due on or before today and generate pre-filled invoices."
      maxWidth="md"
    >
      <div className="space-y-5">
        {!summary ? (
          <>
            <div className="p-4 rounded-xl bg-primary-500/[0.04] border border-primary-500/20 text-body space-y-2">
              <div className="flex items-center gap-2 text-primary-300 font-semibold">
                <Zap className="h-4 w-4" />
                Automated Zero-Duplicate Guarantee
              </div>
              <p className="text-caption text-zinc-300 leading-relaxed">
                Brightloop's billing engine applies an idempotent constraint across subscription billing periods.
                Running this job multiple times will never duplicate invoices or charges.
              </p>
              <ul className="text-caption text-zinc-400 space-y-1 list-disc pl-4 pt-1">
                <li>Advances next billing date to the subsequent period</li>
                <li>Auto-applies best matching product or contract discounts</li>
                <li>Applies exclusive/inclusive GST rates strictly in integer paise math</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <Button variant="secondary" onClick={handleClose} disabled={billingMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={billingMutation.isPending}
                onClick={handleRun}
              >
                <Zap className="h-4 w-4" />
                Execute Billing Run
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Run Results */}
            <div className="text-center py-4">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-glow-green">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-heading text-zinc-100 font-bold">Billing Cycle Execution Done</h3>
              <p className="text-caption text-zinc-400 mt-1">
                Summary of operations performed across all customer subscriptions
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center tnum">
              <div className="p-2">
                <span className="text-caption text-zinc-500 block uppercase">Created</span>
                <span className="text-display text-emerald-400 font-bold">{summary.created}</span>
              </div>
              <div className="p-2 border-x border-white/[0.06]">
                <span className="text-caption text-zinc-500 block uppercase">Skipped</span>
                <span className="text-display text-zinc-300 font-bold">{summary.skipped}</span>
              </div>
              <div className="p-2">
                <span className="text-caption text-zinc-500 block uppercase">Failed</span>
                <span className="text-display text-red-400 font-bold">{summary.failed}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-white/[0.08]">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRun}
                loading={billingMutation.isPending}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Run Again (Verify Idempotency)
              </Button>
              <Button variant="primary" onClick={handleClose}>
                Done
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
