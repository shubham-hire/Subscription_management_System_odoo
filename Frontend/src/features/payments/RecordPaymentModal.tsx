import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import Decimal from 'decimal.js';
import { getInvoices, recordPayment } from '@/api/domain';
import type { Invoice, Payment, RecordPaymentPayload } from '@/types';
import { todayIST } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import {
  Button,
  Field,
  Input,
  Select,
  Textarea,
  Dialog,
  useToast,
} from '@/components/ui';

interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  preselectedInvoice?: Invoice | null;
  onRecorded?: (payment: Payment) => void;
}

export function RecordPaymentModal({
  open,
  onClose,
  preselectedInvoice,
  onRecorded,
}: RecordPaymentModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [invoiceId, setInvoiceId] = useState(preselectedInvoice?.id ?? '');
  const [method, setMethod] = useState<Payment['method']>('upi');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayIST());
  const [note, setNote] = useState('');

  // Fetch confirmed unpaid/partially-paid invoices for dropdown
  const invoicesQuery = useQuery({
    queryKey: ['invoices', 'payable'],
    queryFn: () => getInvoices({ status: 'confirmed', page_size: 100 }),
    enabled: open && !preselectedInvoice,
  });

  const payableInvoices = invoicesQuery.data?.items ?? [];

  // Determine active invoice
  const activeInvoice =
    preselectedInvoice ?? payableInvoices.find((inv) => inv.id === invoiceId);

  // Compute remaining balance
  const remainingBalance = activeInvoice
    ? new Decimal(activeInvoice.total).minus(new Decimal(activeInvoice.amount_paid)).toFixed(2)
    : '0.00';

  // When invoice changes, default the payment amount to full remaining balance
  useEffect(() => {
    if (activeInvoice) {
      setAmount(remainingBalance);
    }
  }, [invoiceId, preselectedInvoice, remainingBalance]);

  const recordMutation = useMutation({
    mutationFn: (payload: RecordPaymentPayload) => recordPayment(activeInvoice!.id, payload),
    onSuccess: (payment) => {
      toast('success', `Payment of ${formatMoney(payment.amount)} recorded.`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      onClose();
      if (onRecorded) onRecorded(payment);
    },
    onError: (err) => {
      toast('error', err instanceof Error ? err.message : 'Failed to record payment.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvoice) {
      toast('error', 'Please select an invoice to record payment against.');
      return;
    }
    const payVal = new Decimal(amount || '0');
    if (payVal.lessThanOrEqualTo(0)) {
      toast('error', 'Payment amount must be greater than zero.');
      return;
    }
    const maxVal = new Decimal(remainingBalance);
    if (payVal.greaterThan(maxVal)) {
      toast('error', `Payment cannot exceed remaining invoice balance of ${formatMoney(remainingBalance)}.`);
      return;
    }

    recordMutation.mutate({
      method,
      amount: payVal.toFixed(2),
      payment_date: paymentDate,
      note: note.trim() || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record Payment"
      description="Record partial or full customer settlement against confirmed invoices."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Invoice select or pre-filled badge */}
        {preselectedInvoice ? (
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between">
            <div>
              <span className="text-caption text-zinc-500 uppercase tracking-wider block">
                Target Invoice
              </span>
              <span className="font-mono text-body font-bold text-zinc-100">
                {preselectedInvoice.number}
              </span>
              <span className="text-caption text-zinc-400 block">
                {preselectedInvoice.customer_name}
              </span>
            </div>
            <div className="text-right">
              <span className="text-caption text-zinc-500 uppercase tracking-wider block">
                Balance Due
              </span>
              <span className="text-heading font-bold text-amber-400 tnum">
                {formatMoney(remainingBalance)}
              </span>
            </div>
          </div>
        ) : (
          <Field label="Target Invoice" required>
            <Select
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              required
            >
              <option value="">Select confirmed invoice...</option>
              {payableInvoices.map((inv) => {
                const bal = new Decimal(inv.total).minus(new Decimal(inv.amount_paid)).toFixed(2);
                return (
                  <option key={inv.id} value={inv.id}>
                    {inv.number} — {inv.customer_name} (Balance: {formatMoney(bal)})
                  </option>
                );
              })}
            </Select>
          </Field>
        )}

        {/* Payment Amount & Method */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Payment Amount (₹)"
            required
            hint={activeInvoice ? `Max balance: ${formatMoney(remainingBalance)}` : undefined}
          >
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={remainingBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="tnum font-semibold text-zinc-100"
              required
            />
          </Field>

          <Field label="Payment Method" required>
            <Select
              value={method}
              onChange={(e) => setMethod(e.target.value as Payment['method'])}
            >
              <option value="upi">UPI (Instant)</option>
              <option value="card">Credit / Debit Card</option>
              <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </Select>
          </Field>
        </div>

        <Field label="Payment Date" required>
          <Input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
          />
        </Field>

        <Field label="Transaction Reference / Note">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. UTR # 349182049182 / HDFC Bank"
          />
        </Field>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-3 border-t border-white/[0.08]">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={recordMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="success"
            loading={recordMutation.isPending}
          >
            <CheckCircle2 className="h-4 w-4" />
            Confirm Payment
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
