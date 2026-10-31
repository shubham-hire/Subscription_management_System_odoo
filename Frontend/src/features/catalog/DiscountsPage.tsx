import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Edit2, Tag } from 'lucide-react';
import { getDiscounts, createDiscount, updateDiscount } from '@/api/catalog';
import { ApiError } from '@/api/client';
import { discountSchema, type DiscountFormValues } from '@/lib/schemas';
import { formatMoney } from '@/lib/money';
import type { Discount } from '@/types';
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

export function DiscountsPage() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null);
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['discounts', page],
    queryFn: () => getDiscounts({ page, page_size: pageSize }),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DiscountFormValues>({
    resolver: zodResolver(discountSchema),
    defaultValues: {
      name: '',
      type: 'percentage',
      value: '',
      scope: 'product',
      start_date: 'new Date().toISOString().slice(0, 10)',
      end_date: 'new Date().toISOString().slice(0, 10)',
    },
  });

  const currentType = watch('type');

  const openCreateDialog = () => {
    setSelectedDiscount(null);
    reset({
      name: '',
      type: 'percentage',
      value: '',
      scope: 'product',
      start_date: 'new Date().toISOString().slice(0, 10)',
      end_date: 'new Date().toISOString().slice(0, 10)',
    });
    setDialogMode('create');
  };

  const openEditDialog = (discount: Discount) => {
    setSelectedDiscount(discount);
    reset({
      name: discount.name,
      type: discount.type,
      value: discount.value,
      scope: discount.scope,
      start_date: discount.startDate.slice(0, 10),
      end_date: discount.endDate.slice(0, 10),
    });
    setDialogMode('edit');
  };

  const closeDialog = () => {
    setDialogMode(null);
    setSelectedDiscount(null);
    reset();
  };

  const createMutation = useMutation({
    mutationFn: createDiscount,
    onSuccess: () => {
      toast('success', 'Discount coupon created successfully.');
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      closeDialog();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fields) {
        Object.entries(err.fields).forEach(([f, msg]) => {
          setError(f as keyof DiscountFormValues, { message: msg });
        });
      } else {
        toast('error', err instanceof Error ? err.message : 'Failed to create discount.');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: DiscountFormValues }) =>
      updateDiscount(id, payload),
    onSuccess: () => {
      toast('success', 'Discount updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      closeDialog();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fields) {
        Object.entries(err.fields).forEach(([f, msg]) => {
          setError(f as keyof DiscountFormValues, { message: msg });
        });
      } else {
        toast('error', err instanceof Error ? err.message : 'Failed to update discount.');
      }
    },
  });

  const onSubmit = async (values: DiscountFormValues) => {
    if (dialogMode === 'create') {
      await createMutation.mutateAsync(values);
    } else if (dialogMode === 'edit' && selectedDiscount) {
      await updateMutation.mutateAsync({ id: selectedDiscount.id, payload: values });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-heading text-gray-900">Discounts & Coupons</h1>
          <p className="mt-1 text-body text-gray-500">
            Manage promotional codes, percentage discounts, and fixed promotional credits.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Add Discount
        </Button>
      </div>

      <Card padding="none">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Validity</TableHeader>
              <TableHeader>Campaign Name</TableHeader>
              <TableHeader>Type</TableHeader>
              <TableHeader>Value</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Created</TableHeader>
              <TableHeader className="text-right">Actions</TableHeader>
            </TableRow>
          </TableHead>

          {isLoading && <TableSkeleton columns={7} rows={4} />}

          {isError && (
            <TableError
              columns={7}
              message={error instanceof Error ? error.message : 'Failed to load discounts.'}
              onRetry={() => refetch()}
            />
          )}

          {!isLoading && !isError && data && data.items.length === 0 && (
            <TableEmpty columns={7} message="No discounts created yet. Click 'Add Discount' to start." />
          )}

          {!isLoading && !isError && data && data.items.length > 0 && (
            <TableBody>
              {data.items.map((discount) => (
                <TableRow key={discount.id}>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 font-mono text-caption font-semibold px-2.5 py-1 rounded bg-gray-100 text-gray-800 border border-gray-200">
                      <Tag className="h-3 w-3 text-gray-500" />
                      {discount.name}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">{discount.name}</TableCell>
                  <TableCell className="capitalize text-gray-600">
                    {discount.type === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                  </TableCell>
                  <TableCell className="font-semibold text-gray-900">
                    {discount.type === 'percentage'
                      ? `${discount.value}% OFF`
                      : `${formatMoney(discount.value)} OFF`}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={discount.isActive ? 'active' : 'closed'} />
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {discount.startDate.slice(0, 10)} → {discount.endDate.slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(discount)}
                      aria-label={`Edit ${discount.name}`}
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

        {data && (
          <TablePagination
            page={data.page}
            pageSize={data.page_size}
            total={data.total}
            onPageChange={(newPage) => setPage(newPage)}
          />
        )}
      </Card>

      {/* ─── Create / Edit Dialog ─── */}
      <Dialog
        open={dialogMode !== null}
        onClose={closeDialog}
        title={dialogMode === 'create' ? 'Create Discount Coupon' : 'Edit Discount'}
        description="Coupons can be applied to customer subscriptions or one-off invoices."
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="discount-form"
              loading={isSubmitting}
            >
              {dialogMode === 'create' ? 'Create Discount' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <form id="discount-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date" htmlFor="disc-start" error={errors.start_date?.message}>
              <Input
                id="disc-start"
                type="date"
                hasError={!!errors.start_date}
                {...register('start_date')}
              />
            </Field>

            <Field label="End Date" htmlFor="disc-end" error={errors.end_date?.message}>
              <Input
                id="disc-end"
                type="date"
                hasError={!!errors.end_date}
                {...register('end_date')}
              />
            </Field>
          </div>

          <Field label="Applies To" htmlFor="disc-scope" error={errors.scope?.message}>
            <Select id="disc-scope" hasError={!!errors.scope} {...register('scope')}>
              <option value="product">Specific Products</option>
              <option value="subscription">Whole Subscription</option>
            </Select>
          </Field>

          <Field label="Discount Name / Description" htmlFor="disc-name" error={errors.name?.message}>
            <Input
              id="disc-name"
              placeholder="e.g. Summer Promotional Discount"
              hasError={!!errors.name}
              {...register('name')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount Type" htmlFor="disc-type" error={errors.type?.message}>
              <Select id="disc-type" hasError={!!errors.type} {...register('type')}>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (INR)</option>
              </Select>
            </Field>

            <Field
              label={currentType === 'percentage' ? 'Rate (%)' : 'Amount (INR)'}
              htmlFor="disc-val"
              error={errors.value?.message}
            >
              <Input
                id="disc-val"
                placeholder={currentType === 'percentage' ? '20.00' : '500.00'}
                hasError={!!errors.value}
                {...register('value')}
              />
            </Field>
          </div>


        </form>
      </Dialog>
    </div>
  );
}
