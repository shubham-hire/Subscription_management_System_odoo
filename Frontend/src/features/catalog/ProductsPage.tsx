import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Edit2 } from 'lucide-react';
import { getProducts, createProduct, updateProduct } from '@/api/catalog';
import { ApiError } from '@/api/client';
import { productSchema, type ProductFormValues } from '@/lib/schemas';
import type { Product } from '@/types';
import {
  Button,
  Card,
  Field,
  Input,
  Textarea,
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

export function ProductsPage() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['products', page],
    queryFn: () => getProducts({ page, page_size: pageSize }),
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      type: '',
      sales_price: '',
      cost_price: '',
      notes: '',
    },
  });

  const openCreateDialog = () => {
    setSelectedProduct(null);
    reset({
      name: '',
      type: '',
      sales_price: '',
      cost_price: '',
      notes: '',
    });
    setDialogMode('create');
  };

  const openEditDialog = (product: Product) => {
    setSelectedProduct(product);
    reset({
      name: product.name,
      type: product.type,
      sales_price: product.salesPrice,
      cost_price: product.costPrice,
      notes: product.notes ?? '',
    });
    setDialogMode('edit');
  };

  const closeDialog = () => {
    setDialogMode(null);
    setSelectedProduct(null);
    reset();
  };

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      toast('success', 'Product created successfully.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeDialog();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fields) {
        Object.entries(err.fields).forEach(([f, msg]) => {
          setError(f as keyof ProductFormValues, { message: msg });
        });
      } else {
        toast('error', err instanceof Error ? err.message : 'Failed to create product.');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ProductFormValues }) =>
      updateProduct(id, payload),
    onSuccess: () => {
      toast('success', 'Product updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeDialog();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fields) {
        Object.entries(err.fields).forEach(([f, msg]) => {
          setError(f as keyof ProductFormValues, { message: msg });
        });
      } else {
        toast('error', err instanceof Error ? err.message : 'Failed to update product.');
      }
    },
  });

  const onSubmit = async (values: ProductFormValues) => {
    if (dialogMode === 'create') {
      await createMutation.mutateAsync(values);
    } else if (dialogMode === 'edit' && selectedProduct) {
      await updateMutation.mutateAsync({ id: selectedProduct.id, payload: values });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-heading text-gray-900">Products</h1>
          <p className="mt-1 text-body text-gray-500">
            Define software products and offerings available for billing subscriptions.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      <Card padding="none">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Product Name</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Created</TableHeader>
              <TableHeader className="text-right">Actions</TableHeader>
            </TableRow>
          </TableHead>

          {isLoading && <TableSkeleton columns={5} rows={4} />}

          {isError && (
            <TableError
              columns={5}
              message={error instanceof Error ? error.message : 'Failed to load products.'}
              onRetry={() => refetch()}
            />
          )}

          {!isLoading && !isError && data?.items.length === 0 && (
            <TableEmpty columns={5} message="No products created yet. Click 'Add Product' to start." />
          )}

          {!isLoading && !isError && data && data.items.length > 0 && (
            <TableBody>
              {data.items.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium text-gray-900">{product.name}</TableCell>
                  <TableCell className="text-gray-500 max-w-md truncate">
                    {product.notes || '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={product.isActive ? 'active' : 'closed'} />
                  </TableCell>
                  <TableCell className="text-gray-500">
                    '—'
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(product)}
                      aria-label={`Edit ${product.name}`}
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
        title={dialogMode === 'create' ? 'Create New Product' : 'Edit Product'}
        description="Products represent your core services or packages that contain pricing plans."
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="product-form"
              loading={isSubmitting}
            >
              {dialogMode === 'create' ? 'Create Product' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Product Name" htmlFor="prod-name" error={errors.name?.message}>
            <Input
              id="prod-name"
              placeholder="e.g. Enterprise Cloud Suite"
              hasError={!!errors.name}
              {...register('name')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Product Type" htmlFor="prod-type" error={errors.type?.message}>
              <Input
                id="prod-type"
                placeholder="e.g. software"
                hasError={!!errors.type}
                {...register('type')}
              />
            </Field>

            <Field label="Sales Price (INR)" htmlFor="prod-price" error={errors.sales_price?.message}>
              <Input
                id="prod-price"
                placeholder="2999.00"
                hasError={!!errors.sales_price}
                {...register('sales_price')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost Price (INR)" htmlFor="prod-cost" error={errors.cost_price?.message}>
              <Input
                id="prod-cost"
                placeholder="1500.00"
                hasError={!!errors.cost_price}
                {...register('cost_price')}
              />
            </Field>
          </div>

          <Field label="Notes" htmlFor="prod-notes" error={errors.notes?.message}>
            <Textarea
              id="prod-notes"
              placeholder="Optional internal notes..."
              hasError={!!errors.notes}
              {...register('notes')}
            />
          </Field>
        </form>
      </Dialog>
    </div>
  );
}
