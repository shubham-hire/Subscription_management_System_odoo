import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Calculator, Sparkles, CheckCircle2 } from 'lucide-react';
import Decimal from 'decimal.js';
import { getCustomers, createSubscription } from '@/api/domain';
import { getProducts, getPlans, getTaxes } from '@/api/catalog';
import type {
  PaymentTerms,
  CreateSubscriptionPayload,
} from '@/types';
import { todayIST, addPeriod } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import {
  Button,
  Field,
  Input,
  Select,
  Dialog,
  useToast,
} from '@/components/ui';

interface CreateSubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (subId: string) => void;
}

interface FormLine {
  id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  tax_id: string;
}

export function CreateSubscriptionModal({
  open,
  onClose,
  onCreated,
}: CreateSubscriptionModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [customerId, setCustomerId] = useState('');
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState(todayIST());
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>('net_15');
  const [lines, setLines] = useState<FormLine[]>([
    { id: '1', product_id: '', variant_id: '', quantity: 1, tax_id: '' },
  ]);

  // Load supporting catalog and customer lists
  const customersQuery = useQuery({
    queryKey: ['customers', 'all'],
    queryFn: () => getCustomers({ page_size: 100 }),
    enabled: open,
  });

  const plansQuery = useQuery({
    queryKey: ['plans', 'all'],
    queryFn: () => getPlans({ page_size: 100 }),
    enabled: open,
  });

  const productsQuery = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => getProducts({ page_size: 100 }),
    enabled: open,
  });

  const taxesQuery = useQuery({
    queryKey: ['taxes', 'all'],
    queryFn: () => getTaxes({ page_size: 50 }),
    enabled: open,
  });

  const customers = customersQuery.data?.items ?? [];
  const plans = plansQuery.data?.items ?? [];
  const products = productsQuery.data?.items ?? [];
  const taxes = taxesQuery.data?.items ?? [];

  const selectedPlan = plans.find((p) => p.id === planId);

  // Line actions
  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        product_id: '',
        variant_id: '',
        quantity: 1,
        tax_id: '',
      },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 1) {
      toast('error', 'A subscription must have at least one product line.');
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, updates: Partial<FormLine>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...updates };
        // If product changed, reset variant and pre-fill default product tax
        if (updates.product_id !== undefined && updates.product_id !== l.product_id) {
          const prod = products.find((p) => p.id === updates.product_id);
          next.variant_id = '';
          if (prod?.tax_id) next.tax_id = prod.tax_id;
        }
        return next;
      }),
    );
  };

  // Real-time dynamic calculation preview (PRD §6.1 / D4)
  const calculation = useMemo(() => {
    let subtotal = new Decimal(0);
    let taxTotal = new Decimal(0);

    lines.forEach((line) => {
      if (!line.product_id) return;
      const product = products.find((p) => p.id === line.product_id);
      if (!product) return;

      const basePrice = new Decimal(product.sales_price ?? '0');
      let extra = new Decimal(0);

      if (line.variant_id && product.variants) {
        const variant = product.variants.find((v) => v.id === line.variant_id);
        if (variant) extra = new Decimal(variant.price_extra ?? '0');
      }

      const unitPrice = basePrice.plus(extra);
      const lineSubtotal = unitPrice.times(line.quantity);
      subtotal = subtotal.plus(lineSubtotal);

      // Tax calculation
      const tax = taxes.find((t) => t.id === line.tax_id);
      if (tax) {
        const rate = new Decimal(tax.rate).dividedBy(100);
        const lineTax = lineSubtotal.times(rate);
        taxTotal = taxTotal.plus(lineTax);
      }
    });

    const total = subtotal.plus(taxTotal);
    return {
      subtotal: subtotal.toFixed(2),
      taxTotal: taxTotal.toFixed(2),
      total: total.toFixed(2),
    };
  }, [lines, products, taxes]);

  // Next billing date preview based on selected plan
  const billingDates = useMemo(() => {
    if (!selectedPlan || !startDate) return null;
    try {
      const nextDate = addPeriod(
        startDate,
        selectedPlan.billing_interval,
        selectedPlan.interval_count,
      );
      return { nextDate };
    } catch {
      return null;
    }
  }, [selectedPlan, startDate]);

  // Mutation
  const createMutation = useMutation({
    mutationFn: createSubscription,
    onSuccess: (sub) => {
      toast('success', `Subscription quotation ${sub.number} created.`);
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      onClose();
      if (onCreated) onCreated(sub.id);
    },
    onError: (err) => {
      toast('error', err instanceof Error ? err.message : 'Failed to create subscription.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      toast('error', 'Please select a customer.');
      return;
    }
    if (!planId) {
      toast('error', 'Please select a billing plan.');
      return;
    }
    const invalidLine = lines.find((l) => !l.product_id || l.quantity < 1);
    if (invalidLine) {
      toast('error', 'Please ensure all lines have a valid product and quantity of at least 1.');
      return;
    }

    const payload: CreateSubscriptionPayload = {
      customer_id: customerId,
      plan_id: planId,
      start_date: startDate,
      payment_terms: paymentTerms,
      lines: lines.map((l) => ({
        product_id: l.product_id,
        variant_id: l.variant_id || null,
        quantity: Number(l.quantity),
        tax_id: l.tax_id || null,
      })),
    };

    createMutation.mutate(payload);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create Subscription"
      description="Setup a new contract quotation with flexible product lines, variant addons, and billing schedule."
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Top meta selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <Field label="Customer" required>
            <Select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              <option value="">Select customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company ? `(${c.company})` : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Billing Plan" required>
            <Select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              required
            >
              <option value="">Select plan...</option>
              {plans
                .filter((p) => p.status === 'active')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.interval_count > 1 ? `${p.interval_count} ` : ''}{p.billing_interval}ly)
                  </option>
                ))}
            </Select>
          </Field>

          <Field label="Start Date" required>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </Field>

          <Field label="Payment Terms" required>
            <Select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value as PaymentTerms)}
            >
              <option value="immediate">Due Immediate (Net 0)</option>
              <option value="net_15">Net 15 Days</option>
              <option value="net_30">Net 30 Days</option>
            </Select>
          </Field>
        </div>

        {/* Lines section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-subheading text-zinc-100 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary-400" />
              Subscription Line Items
            </h4>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addLine}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Product Line
            </Button>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {lines.map((line) => {
              const product = products.find((p) => p.id === line.product_id);
              const variants = product?.variants ?? [];
              const selectedVariant = variants.find((v) => v.id === line.variant_id);

              const basePrice = product?.sales_price ? new Decimal(product.sales_price) : new Decimal(0);
              const extra = selectedVariant?.price_extra ? new Decimal(selectedVariant.price_extra) : new Decimal(0);
              const unitEffective = basePrice.plus(extra);
              const lineTotal = unitEffective.times(line.quantity || 0);

              return (
                <div
                  key={line.id}
                  className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.07] grid grid-cols-12 gap-3 items-center"
                >
                  {/* Product */}
                  <div className="col-span-12 sm:col-span-4">
                    <label className="text-caption text-zinc-500 mb-1 block">Product</label>
                    <Select
                      value={line.product_id}
                      onChange={(e) => updateLine(line.id, { product_id: e.target.value })}
                      required
                    >
                      <option value="">Select product...</option>
                      {products
                        .filter((p) => p.status === 'active')
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({formatMoney(p.sales_price ?? '0')})
                          </option>
                        ))}
                    </Select>
                  </div>

                  {/* Variant */}
                  <div className="col-span-12 sm:col-span-3">
                    <label className="text-caption text-zinc-500 mb-1 block">Variant / Add-on</label>
                    <Select
                      value={line.variant_id}
                      onChange={(e) => updateLine(line.id, { variant_id: e.target.value })}
                      disabled={variants.length === 0}
                    >
                      <option value="">No Variant (Base)</option>
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.attribute}: {v.value} (+{formatMoney(v.price_extra)})
                        </option>
                      ))}
                    </Select>
                  </div>

                  {/* Qty */}
                  <div className="col-span-4 sm:col-span-1">
                    <label className="text-caption text-zinc-500 mb-1 block">Qty</label>
                    <Input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(line.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
                      }
                      className="tnum text-center px-2"
                      required
                    />
                  </div>

                  {/* Tax */}
                  <div className="col-span-8 sm:col-span-2">
                    <label className="text-caption text-zinc-500 mb-1 block">Tax</label>
                    <Select
                      value={line.tax_id}
                      onChange={(e) => updateLine(line.id, { tax_id: e.target.value })}
                    >
                      <option value="">No Tax (0%)</option>
                      {taxes
                        .filter((t) => t.status === 'active')
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.rate}%)
                          </option>
                        ))}
                    </Select>
                  </div>

                  {/* Line Total & Remove */}
                  <div className="col-span-12 sm:col-span-2 flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-4">
                    <div className="text-right">
                      <span className="text-caption text-zinc-500 block">Line Total</span>
                      <span className="font-semibold text-zinc-100 tnum">
                        {formatMoney(lineTotal.toFixed(2))}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove line"
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Calculation Summary Footer */}
        <div className="p-4 rounded-xl bg-primary-500/[0.04] border border-primary-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-caption text-zinc-400">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary-400" />
              <span className="font-medium text-zinc-200">Recurring Schedule:</span>
              <span>
                {selectedPlan
                  ? `Every ${selectedPlan.interval_count > 1 ? `${selectedPlan.interval_count} ` : ''}${selectedPlan.billing_interval} (Starts ${startDate})`
                  : 'Select plan to preview dates'}
              </span>
            </div>
            {billingDates && (
              <p className="text-zinc-500">
                First recurring renewal due on <span className="text-zinc-300 font-medium">{billingDates.nextDate}</span>.
              </p>
            )}
          </div>

          <div className="flex items-center gap-6 text-right">
            <div>
              <span className="text-caption text-zinc-500 block">Subtotal</span>
              <span className="text-body font-medium text-zinc-300 tnum">
                {formatMoney(calculation.subtotal)}
              </span>
            </div>
            <div>
              <span className="text-caption text-zinc-500 block">Tax</span>
              <span className="text-body font-medium text-zinc-300 tnum">
                {formatMoney(calculation.taxTotal)}
              </span>
            </div>
            <div className="pl-4 border-l border-white/[0.08]">
              <span className="text-caption text-primary-400 font-semibold uppercase tracking-wider block">
                Total / Period
              </span>
              <span className="text-heading text-zinc-100 font-bold tnum">
                {formatMoney(calculation.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-white/[0.08]">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={createMutation.isPending}
          >
            <CheckCircle2 className="h-4 w-4" />
            Create Quotation
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
