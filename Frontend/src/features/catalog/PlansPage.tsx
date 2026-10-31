import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Edit2 } from 'lucide-react';
import { getPlans, createPlan, updatePlan } from '@/api/catalog';
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


  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: '',
      price: '',
      billing_period: 'monthly',
      min_quantity: 1,
      available_from: 'new Date().toISOString().slice(0, 10)',
      available_to: 'new Date().toISOString().slice(0, 10)',
    },
  });

  const openCreateDialog = () => {
    setSelectedPlan(null);
    reset({
      name: '',
      price: '',
      billing_period: 'monthly',
      min_quantity: 1,
      available_from: 'new Date().toISOString().slice(0, 10)',
      available_to: 'new Date().toISOString().slice(0, 10)',
    });
    setDialogMode('create');
  };

  const openEditDialog = (plan: Plan) => {
    setSelectedPlan(plan);
    reset({
      name: plan.name,
      price: plan.price,
      billing_period: plan.billingPeriod,
      min_quantity: plan.minQuantity,
      available_from: plan.availableFrom.slice(0, 10),
      available_to: plan.availableTo.slice(0, 10),
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
    mutationFn: ({ id, payload }: { id: number; payload: PlanFormValues }) =>
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
                  <TableCell className="text-gray-600">Min {plan.minQuantity} seat(s)</TableCell>
                  <TableCell className="text-gray-600 capitalize">
                    {plan.billingPeriod}
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">
                    {formatMoney(plan.price)}
                  </TableCell>
                  <TableCell className="text-gray-500 text-caption">
                    {plan.availableFrom.slice(0, 10)} → {plan.availableTo.slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={plan.isActive ? 'active' : 'closed'} />
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
          <Field label="Plan Name" htmlFor="plan-name" error={errors.name?.message}>
            <Input
              id="plan-name"
              placeholder="e.g. Pro Monthly"
              hasError={!!errors.name}
              {...register('name')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Billing Period" htmlFor="plan-interval" error={errors.billing_period?.message}>
              <Select id="plan-interval" hasError={!!errors.billing_period} {...register('billing_period')}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </Select>
            </Field>

            <Field label="Minimum Quantity" htmlFor="plan-count" error={errors.min_quantity?.message}>
              <Input
                id="plan-count"
                type="number"
                min="1"
                hasError={!!errors.min_quantity}
                {...register('min_quantity', { valueAsNumber: true })}
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

            <Field label="Available From" htmlFor="plan-from" error={errors.available_from?.message}>
              <Input
                id="plan-from"
                type="date"
                hasError={!!errors.available_from}
                {...register('available_from')}
              />
            </Field>
          </div>

          <Field label="Available To" htmlFor="plan-to" error={errors.available_to?.message}>
            <Input
              id="plan-to"
              type="date"
              hasError={!!errors.available_to}
              {...register('available_to')}
            />
          </Field>
        </form>
      </Dialog>
    </div>
  );
}
