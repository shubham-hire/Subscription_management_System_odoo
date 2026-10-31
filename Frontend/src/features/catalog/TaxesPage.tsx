import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Edit2 } from 'lucide-react';
import { getTaxes, createTax, updateTax } from '@/api/catalog';
import { ApiError } from '@/api/client';
import { taxSchema, type TaxFormValues } from '@/lib/schemas';
import type { Tax } from '@/types';
import {
  Button,
  Card,
  Field,
  Input,
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

export function TaxesPage() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null);
  const [selectedTax, setSelectedTax] = useState<Tax | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['taxes', page],
    queryFn: () => getTaxes({ page, page_size: pageSize }),
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TaxFormValues>({
    resolver: zodResolver(taxSchema),
    defaultValues: {
      name: '',
      percentage: 18,
    },
  });

  const openCreateDialog = () => {
    setSelectedTax(null);
    reset({
      name: '',
      percentage: 18,
    });
    setDialogMode('create');
  };

  const openEditDialog = (tax: Tax) => {
    setSelectedTax(tax);
    reset({
      name: tax.name,
      percentage: Number(tax.percentage),
    });
    setDialogMode('edit');
  };

  const closeDialog = () => {
    setDialogMode(null);
    setSelectedTax(null);
    reset();
  };

  const createMutation = useMutation({
    mutationFn: createTax,
    onSuccess: () => {
      toast('success', 'Tax rule created successfully.');
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
      closeDialog();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fields) {
        Object.entries(err.fields).forEach(([f, msg]) => {
          setError(f as keyof TaxFormValues, { message: msg });
        });
      } else {
        toast('error', err instanceof Error ? err.message : 'Failed to create tax rule.');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TaxFormValues }) =>
      updateTax(id, payload),
    onSuccess: () => {
      toast('success', 'Tax rule updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
      closeDialog();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fields) {
        Object.entries(err.fields).forEach(([f, msg]) => {
          setError(f as keyof TaxFormValues, { message: msg });
        });
      } else {
        toast('error', err instanceof Error ? err.message : 'Failed to update tax rule.');
      }
    },
  });

  const onSubmit = async (values: TaxFormValues) => {
    if (dialogMode === 'create') {
      await createMutation.mutateAsync(values);
    } else if (dialogMode === 'edit' && selectedTax) {
      await updateMutation.mutateAsync({ id: selectedTax.id, payload: values });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-heading text-gray-900">Tax Rates</h1>
          <p className="mt-1 text-body text-gray-500">
            Configure GST, VAT, and territorial tax rules applied during invoice generation.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Add Tax Rate
        </Button>
      </div>

      <Card padding="none">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Tax Rule</TableHeader>
              <TableHeader>Rate</TableHeader>
              <TableHeader>Application</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Created</TableHeader>
              <TableHeader className="text-right">Actions</TableHeader>
            </TableRow>
          </TableHead>

          {isLoading && <TableSkeleton columns={6} rows={4} />}

          {isError && (
            <TableError
              columns={6}
              message={error instanceof Error ? error.message : 'Failed to load tax rates.'}
              onRetry={() => refetch()}
            />
          )}

          {!isLoading && !isError && data && data.items.length === 0 && (
            <TableEmpty columns={6} message="No tax rules configured. Click 'Add Tax Rate' to create one." />
          )}

          {!isLoading && !isError && data && data.items.length > 0 && (
            <TableBody>
              {data.items.map((tax) => (
                <TableRow key={tax.id}>
                  <TableCell className="font-medium text-gray-900">{tax.name}</TableCell>
                  <TableCell className="font-semibold text-gray-900">{tax.percentage}%</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-caption font-medium bg-blue-50 text-blue-700">
                      Exclusive (Added to subtotal)
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={tax.isActive ? 'active' : 'closed'} />
                  </TableCell>
                  <TableCell className="text-gray-500">
                    '—'
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(tax)}
                      aria-label={`Edit ${tax.name}`}
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
        title={dialogMode === 'create' ? 'Create Tax Rate' : 'Edit Tax Rate'}
        description="Tax rules automatically calculate tax line items on recurring invoices."
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="tax-form"
              loading={isSubmitting}
            >
              {dialogMode === 'create' ? 'Create Tax Rate' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <form id="tax-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Tax Name" htmlFor="tax-name" error={errors.name?.message}>
            <Input
              id="tax-name"
              placeholder="e.g. GST 18%"
              hasError={!!errors.name}
              {...register('name')}
            />
          </Field>

          <Field label="Tax Rate (%)" htmlFor="tax-percentage" error={errors.percentage?.message}>
            <Input
              id="tax-percentage"
              placeholder="18.00"
              hasError={!!errors.percentage}
              {...register('percentage')}
            />
          </Field>


        </form>
      </Dialog>
    </div>
  );
}
