import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Printer,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import Decimal from 'decimal.js';
import { transitionInvoice } from '@/api/domain';
import type { Invoice } from '@/types';
import { formatDate, todayIST } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import {
  Button,
  StatusBadge,
  Dialog,
  useToast,
} from '@/components/ui';

interface InvoiceDetailModalProps {
  invoice: Invoice;
  onClose: () => void;
  onRecordPayment?: (invoice: Invoice) => void;
  onUpdated?: () => void;
}

export function InvoiceDetailModal({
  invoice,
  onClose,
  onRecordPayment,
  onUpdated,
}: InvoiceDetailModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const balance = new Decimal(invoice.total).minus(new Decimal(invoice.amountPaid));
  const isOverdue =
    invoice.status === 'confirmed' &&
    balance.greaterThan(0) &&
    invoice.dueDate < todayIST();

  const confirmMutation = useMutation({
    mutationFn: () => transitionInvoice(invoice.id, 'confirm'),
    onSuccess: (updated) => {
      toast('success', `Invoice ${updated.number} confirmed.`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      if (onUpdated) onUpdated();
    },
    onError: (err) => {
      toast('error', err instanceof Error ? err.message : 'Failed to confirm invoice.');
    },
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title={`Invoice ${invoice.number}`}
      description={`Billed to ${invoice.customer?.name ?? invoice.customerId}`}
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Printable Invoice Header Box */}
        <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.07] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
            <div>
              <span className="text-display font-mono font-bold text-zinc-100 block">
                {invoice.number}
              </span>
              <span className="text-caption text-zinc-400">
                Linked Contract: <strong className="text-zinc-200">{invoice.subscription?.number ?? invoice.subscriptionId}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <StatusBadge status={invoice.status} />
              {isOverdue && (
                <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/25 text-caption font-semibold text-red-300 flex items-center gap-1 shadow-glow-red">
                  <AlertTriangle className="h-3 w-3" />
                  Overdue
                </span>
              )}
            </div>
          </div>

          {/* Dates & Billing info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-caption">
            <div>
              <span className="text-zinc-500 uppercase tracking-wider block">Customer</span>
              <span className="text-body font-semibold text-zinc-100 block truncate">
                {invoice.customer?.name ?? invoice.customerId}
              </span>
            </div>

            <div>
              <span className="text-zinc-500 uppercase tracking-wider block">Issue Date</span>
              <span className="text-body text-zinc-200 font-medium tnum">
                {formatDate(invoice.issueDate)}
              </span>
            </div>

            <div>
              <span className="text-zinc-500 uppercase tracking-wider block">Due Date</span>
              <span className={`text-body font-medium tnum ${isOverdue ? 'text-red-400 font-bold' : 'text-zinc-200'}`}>
                {formatDate(invoice.dueDate)}
              </span>
            </div>

            <div>
              <span className="text-zinc-500 uppercase tracking-wider block">Billing Period</span>
              <span className="text-body text-zinc-300 font-medium tnum">
                {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
              </span>
            </div>
          </div>
        </div>

        {/* Itemized Line Items Table */}
        <div className="rounded-xl border border-white/[0.07] overflow-hidden">
          <table className="w-full text-body text-left tnum">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                <th className="px-4 py-3 text-caption font-semibold text-zinc-500 uppercase">Item Description</th>
                <th className="px-3 py-3 text-caption font-semibold text-zinc-500 uppercase text-center">Qty</th>
                <th className="px-3 py-3 text-caption font-semibold text-zinc-500 uppercase text-right">Unit Price</th>
                <th className="px-3 py-3 text-caption font-semibold text-zinc-500 uppercase text-right">Discount</th>
                <th className="px-3 py-3 text-caption font-semibold text-zinc-500 uppercase text-right">Tax</th>
                <th className="px-4 py-3 text-caption font-semibold text-zinc-500 uppercase text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {invoice.lines.map((l) => (
                <tr key={l.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-zinc-200 font-medium">{l.description}</td>
                  <td className="px-3 py-3 text-center text-zinc-300">{l.quantity}</td>
                  <td className="px-3 py-3 text-right text-zinc-300">{formatMoney(l.unitPrice)}</td>
                  <td className="px-3 py-3 text-right">
                    {Number(l.discountAmount) > 0 ? (
                      <span className="text-emerald-400 font-medium">
                        -{formatMoney(l.discountAmount)}
                        {l.discountName && (
                          <span className="block text-caption text-emerald-500/80">({l.discountName})</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-zinc-300">
                    {Number(l.taxAmount) > 0 ? (
                      <span>
                        {formatMoney(l.taxAmount)}
                      </span>
                    ) : (
                      <span className="text-zinc-600">0%</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-100 font-semibold">
                    {formatMoney(l.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Summary Calculation Panel */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="space-y-1">
            <span className="text-caption text-zinc-400 block">Payment Settlement</span>
            <div className="flex items-center gap-2">
              <span className="text-caption text-zinc-500">Amount Paid:</span>
              <span className="text-body font-semibold text-emerald-400 tnum">
                {formatMoney(invoice.amountPaid)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-caption text-zinc-500">Balance Outstanding:</span>
              <span className={`text-body font-bold tnum ${balance.greaterThan(0) ? 'text-amber-400' : 'text-zinc-400'}`}>
                {formatMoney(balance.toFixed(2))}
              </span>
            </div>
          </div>

          <div className="w-full sm:w-72 space-y-2 text-right tnum">
            <div className="flex justify-between text-caption text-zinc-400">
              <span>Subtotal:</span>
              <span className="font-medium text-zinc-200">{formatMoney(invoice.subtotal)}</span>
            </div>
            {Number(invoice.discountTotal) > 0 && (
              <div className="flex justify-between text-caption text-emerald-400">
                <span>Discounts Auto-applied:</span>
                <span className="font-medium">-{formatMoney(invoice.discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-caption text-zinc-400">
              <span>Tax Total (GST):</span>
              <span className="font-medium text-zinc-200">{formatMoney(invoice.taxTotal)}</span>
            </div>
            <div className="flex justify-between text-subheading font-bold text-zinc-100 pt-2 border-t border-white/[0.08]">
              <span>Total Due:</span>
              <span className="text-primary-300 text-heading">{formatMoney(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Modal Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.08]" data-print-hide>
          <Button variant="secondary" onClick={handlePrint} size="sm">
            <Printer className="h-4 w-4" />
            Print Invoice
          </Button>

          <div className="flex items-center gap-2">
            {invoice.status === 'draft' && (
              <Button
                variant="primary"
                size="sm"
                loading={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate()}
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirm Invoice
              </Button>
            )}

            {invoice.status === 'confirmed' && balance.greaterThan(0) && onRecordPayment && (
              <Button
                variant="success"
                size="sm"
                onClick={() => {
                  onClose();
                  onRecordPayment(invoice);
                }}
              >
                <CreditCard className="h-4 w-4" />
                Record Payment
              </Button>
            )}

            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
