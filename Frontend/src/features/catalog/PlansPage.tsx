import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Edit2 } from 'lucide-react';
import { getPlans, getProducts, createPlan, updatePlan } from '@/api/catalog';
import { ApiError } from '@/api/client';
import { planSchema, type PlanFormValues } from '@/lib/schemas';
import { formatMoney } from '@/lib/money';
import type { Plan } from '@/types';
import {
  Button,
  Card,
  Field,
  Input,
  Select,
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
  Dialog,
  useToast,
} from '@/components/ui';

export function PlansPage() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  // Fetch plans
  const { data: plansData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['plans', page],
    queryFn: () => getPlans({ page, page_size: pageSize }),
  });

  // Fetch products for dropdown
  const { data: productsData } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => getProducts({ page: 1, page_size: 100 }),
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      product_id: '',
      name: '',
      billing_interval: 'month',
      interval_count: 1,
      price: '',
      trial_days: 0,
      status: 'active',
    },
  });

  const openCreateDialog = () => {
    setSelectedPlan(null);
    const defaultProductId = productsData?.items[0]?.id || '';
    reset({
      product_id: defaultProductId,
      name: '',
      billing_interval: 'month',
      interval_count: 1,
      price: '',
      trial_days: 0,
      status: 'active',
    });
    setDialogMode('create');
  };

  const openEditDialog = (plan: Plan) => {
    setSelectedPlan(plan);
    reset({
      product_id: plan.product_id,
      name: plan.name,
      billing_interval: plan.billing_interval,
      interval_count: plan.interval_count,
      price: plan.price,
      trial_days: plan.trial_days,
      status: plan.status,
    });
    setDialogMode('edit');
  };

  const closeDialog = () => {
    setDialogMode(null);
    setSelectedPlan(null);
    reset();
  };

  const createMutation = useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      toast('success', 'Pricing plan created successfully.');
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      closeDialog();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fields) {
        Object.entries(err.fields).forEach(([f, msg]) => {
          setError(f as keyof PlanFormValues, { message: msg });
        });
      } else {
        toast('error', err instanceof Error ? err.message : 'Failed to create plan.');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PlanFormValues }) =>
      updatePlan(id, payload),
    onSuccess: () => {
      toast('success', 'Plan updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      closeDialog();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fields) {
        Object.entries(err.fields).forEach(([f, msg]) => {
          setError(f as keyof PlanFormValues, { message: msg });
        });
      } else {
        toast('error', err instanceof Error ? err.message : 'Failed to update plan.');
      }
    },
  });

  const onSubmit = async (values: PlanFormValues) => {
    if (dialogMode === 'create') {
      await createMutation.mutateAsync(values);
    } else if (dialogMode === 'edit' && selectedPlan) {
      await updateMutation.mutateAsync({ id: selectedPlan.id, payload: values });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-heading text-gray-900">Subscription Plans</h1>
          <p className="mt-1 text-body text-gray-500">
            Configure recurring billing cadences, pricing tiers, and trial periods.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Add Plan
        </Button>
      </div>

      <Card padding="none">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Plan Name</TableHeader>
              <TableHeader>Product</TableHeader>
              <TableHeader>Cadence</TableHeader>
              <TableHeader>Price</TableHeader>
              <TableHeader>Trial</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader className="text-right">Actions</TableHeader>
            </TableRow>
          </TableHead>

          {isLoading && <TableSkeleton columns={7} rows={4} />}

          {isError && (
            <TableError
              columns={7}
              message={error instanceof Error ? error.message : 'Failed to load plans.'}
              onRetry={() => refetch()}
            />
          )}

          {!isLoading && !isError && plansData?.items.length === 0 && (
            <TableEmpty columns={7} message="No plans found. Create your first plan above." />
          )}

          {!isLoading && !isError && plansData && plansData.items.length > 0 && (
            <TableBody>
              {plansData.items.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium text-gray-900">{plan.name}</TableCell>
                  <TableCell className="text-gray-600">{plan.product_name || '—'}</TableCell>
                  <TableCell className="text-gray-600 capitalize">
                    {plan.interval_count > 1 ? `Every ${plan.interval_count} ` : 'Every '}
                    {plan.billing_interval}
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">
                    {formatMoney(plan.price)}
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {plan.trial_days > 0 ? `${plan.trial_days} days` : 'None'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={plan.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(plan)}
                      aria-label={`Edit ${plan.name}`}
                    >
                      <Edit2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>

        {plansData && (
          <TablePagination
            page={plansData.page}
            pageSize={plansData.page_size}
            total={plansData.total}
            onPageChange={(newPage) => setPage(newPage)}
          />
        )}
      </Card>

      {/* ─── Create / Edit Dialog ─── */}
      <Dialog
        open={dialogMode !== null}
        onClose={closeDialog}
        title={dialogMode === 'create' ? 'Create Pricing Plan' : 'Edit Plan'}
        description="Plans define how much and how often a subscriber is billed."
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="plan-form"
              loading={isSubmitting}
            >
              {dialogMode === 'create' ? 'Create Plan' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <form id="plan-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Target Product" htmlFor="plan-product" error={errors.product_id?.message}>
            <Select id="plan-product" hasError={!!errors.product_id} {...register('product_id')}>
              <option value="">Select product...</option>
              {productsData?.items.map((prod) => (
                <option key={prod.id} value={prod.id}>
                  {prod.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Plan Name" htmlFor="plan-name" error={errors.name?.message}>
            <Input
              id="plan-name"
              placeholder="e.g. Pro Monthly"
              hasError={!!errors.name}
              {...register('name')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Billing Interval" htmlFor="plan-interval" error={errors.billing_interval?.message}>
              <Select id="plan-interval" hasError={!!errors.billing_interval} {...register('billing_interval')}>
                <option value="month">Month</option>
                <option value="year">Year</option>
                <option value="week">Week</option>
              </Select>
            </Field>

            <Field label="Interval Count" htmlFor="plan-count" error={errors.interval_count?.message}>
              <Input
                id="plan-count"
                type="number"
                min="1"
                hasError={!!errors.interval_count}
                {...register('interval_count', { valueAsNumber: true })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (INR)" htmlFor="plan-price" error={errors.price?.message}>
              <Input
                id="plan-price"
                placeholder="1999.00"
                hasError={!!errors.price}
                {...register('price')}
              />
            </Field>

            <Field label="Trial Days" htmlFor="plan-trial" error={errors.trial_days?.message}>
              <Input
                id="plan-trial"
                type="number"
                min="0"
                placeholder="0"
                hasError={!!errors.trial_days}
                {...register('trial_days', { valueAsNumber: true })}
              />
            </Field>
          </div>

          <Field label="Status" htmlFor="plan-status" error={errors.status?.message}>
            <Select id="plan-status" hasError={!!errors.status} {...register('status')}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="closed">Closed</option>
            </Select>
          </Field>
        </form>
      </Dialog>
    </div>
  );
}
