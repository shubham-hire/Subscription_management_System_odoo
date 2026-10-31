import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus,
  Search,
  Building,
  Mail,
  Phone,
  FileText,
  Receipt,
  MapPin,
} from 'lucide-react';
import { getCustomers, createCustomer, getSubscriptions, getInvoices } from '@/api/domain';
import { ApiError } from '@/api/client';
import { customerSchema, type CustomerFormValues } from '@/lib/schemas';
import type { Customer } from '@/types';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import {
  Button,
  Card,
  Field,
  Input,
  Textarea,
  PageHeader,
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

export function CustomersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const pageSize = 15;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['customers', page, search],
    queryFn: () => getCustomers({ page, page_size: pageSize, search: search || undefined }),
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      company: '',
      email: '',
      phone: '',
      billing_address: '',
      tax_id: '',
    },
  });

  const openCreateDialog = () => {
    reset({
      name: '',
      company: '',
      email: '',
      phone: '',
      billing_address: '',
      tax_id: '',
    });
    setIsCreateOpen(true);
  };

  const closeCreateDialog = () => {
    setIsCreateOpen(false);
    reset();
  };

  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: (newCust) => {
      toast('success', `Customer ${newCust.name} created successfully.`);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      closeCreateDialog();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fields) {
        Object.entries(err.fields).forEach(([f, msg]) => {
          setError(f as keyof CustomerFormValues, { message: msg });
        });
      } else {
        toast('error', err instanceof Error ? err.message : 'Failed to create customer.');
      }
    },
  });

  const onSubmit = (values: CustomerFormValues) => {
    createMutation.mutate({
      name: values.name.trim(),
      company: values.company?.trim() || undefined,
      email: values.email.trim().toLowerCase(),
      phone: values.phone?.trim() || undefined,
      billing_address: values.billing_address?.trim() || undefined,
      tax_id: values.tax_id?.trim() || undefined,
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Client database with billing contact details, GST credentials, and linked contracts."
        actions={
          <Button onClick={openCreateDialog} variant="primary">
            <Plus className="h-4 w-4" />
            New Customer
          </Button>
        }
      />

      {/* ─── Search Bar ─── */}
      <form onSubmit={handleSearchSubmit} className="mb-6 flex gap-3 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, company, or email..."
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary" size="md">
          Search
        </Button>
        {search && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch('');
              setSearchInput('');
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </form>

      {/* ─── Customers Table ─── */}
      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Customer</TableHeader>
              <TableHeader>Company</TableHeader>
              <TableHeader>Contact</TableHeader>
              <TableHeader>Tax ID / GST</TableHeader>
              <TableHeader>Registered</TableHeader>
              <TableHeader className="text-right">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && <TableSkeleton columns={6} rows={8} />}

            {isError && (
              <TableError
                columns={6}
                message={error instanceof Error ? error.message : 'Failed to load customers.'}
                onRetry={() => refetch()}
              />
            )}

            {!isLoading && !isError && data?.items.length === 0 && (
              <TableEmpty
                columns={6}
                title={search ? 'No matching customers found' : 'No customers yet'}
                description={
                  search
                    ? `No customers match query "${search}". Try refining your keywords.`
                    : 'Get started by creating your first customer profile.'
                }
                action={
                  search ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSearch('');
                        setSearchInput('');
                      }}
                    >
                      Clear search
                    </Button>
                  ) : (
                    <Button variant="primary" size="sm" onClick={openCreateDialog}>
                      <Plus className="h-4 w-4" />
                      Add Customer
                    </Button>
                  )
                }
              />
            )}

            {!isLoading &&
              !isError &&
              data?.items.map((cust) => (
                <TableRow
                  key={cust.id}
                  className="cursor-pointer hover:bg-white/[0.03] transition-colors"
                  onClick={() => setSelectedCustomer(cust)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary-500/10 border border-primary-500/25 flex items-center justify-center text-primary-300 font-semibold text-caption flex-shrink-0">
                        {cust.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-zinc-100">{cust.name}</div>
                        <div className="text-caption text-zinc-500">{cust.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {cust.company ? (
                      <span className="inline-flex items-center gap-1.5 text-zinc-300">
                        <Building className="h-3.5 w-3.5 text-zinc-500" />
                        {cust.company}
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {cust.phone ? (
                      <span className="inline-flex items-center gap-1.5 text-zinc-300 tnum">
                        <Phone className="h-3.5 w-3.5 text-zinc-500" />
                        {cust.phone}
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {cust.tax_id ? (
                      <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-caption font-mono text-zinc-300">
                        {cust.tax_id}
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-caption text-zinc-400 tnum">
                    {formatDate(cust.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCustomer(cust);
                      }}
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>

        {data && data.total > pageSize && (
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={data.total}
            onPageChange={setPage}
          />
        )}
      </Card>

      {/* ─── Customer Details Modal ─── */}
      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}

      {/* ─── Create Customer Modal ─── */}
      <Dialog
        open={isCreateOpen}
        onClose={closeCreateDialog}
        title="Create New Customer"
        description="Add a customer account to enable subscriptions and automated invoicing."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name" error={errors.name?.message} required>
              <Input
                {...register('name')}
                placeholder="e.g. Ramesh Kumar"
                hasError={!!errors.name}
              />
            </Field>

            <Field label="Company / Entity" error={errors.company?.message}>
              <Input
                {...register('company')}
                placeholder="e.g. Technova Solutions Pvt Ltd"
                hasError={!!errors.company}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Email Address" error={errors.email?.message} required>
              <Input
                type="email"
                {...register('email')}
                placeholder="ramesh@technova.in"
                hasError={!!errors.email}
              />
            </Field>

            <Field label="Phone Number" error={errors.phone?.message}>
              <Input
                {...register('phone')}
                placeholder="+91 98765 43210"
                hasError={!!errors.phone}
              />
            </Field>
          </div>

          <Field label="Billing Address" error={errors.billing_address?.message}>
            <Textarea
              {...register('billing_address')}
              rows={2}
              placeholder="Unit 402, Alpha Tower, Bandra Kurla Complex, Mumbai, MH - 400051"
              hasError={!!errors.billing_address}
            />
          </Field>

          <Field
            label="Tax ID / GSTIN"
            error={errors.tax_id?.message}
            hint="For B2B invoice tax credits and GST compliance"
          >
            <Input
              {...register('tax_id')}
              placeholder="e.g. 27AABCT3518Q1ZV"
              hasError={!!errors.tax_id}
            />
          </Field>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/[0.08]">
            <Button
              type="button"
              variant="secondary"
              onClick={closeCreateDialog}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              Create Customer
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

// ─── Customer Detail Slide-Over / Modal ───

function CustomerDetailModal({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const subsQuery = useQuery({
    queryKey: ['subscriptions', 'by-customer', customer.id],
    queryFn: () => getSubscriptions({ customer_id: customer.id, page_size: 10 }),
  });

  const invoicesQuery = useQuery({
    queryKey: ['invoices', 'by-customer', customer.id],
    queryFn: () => getInvoices({ customer_id: customer.id, page_size: 10 }),
  });

  const subscriptions = subsQuery.data?.items ?? [];
  const invoices = invoicesQuery.data?.items ?? [];

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title={customer.name}
      description={customer.company ? `Associated with ${customer.company}` : 'Customer Account Profile'}
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Contact Info Header Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="space-y-1">
            <span className="text-caption text-zinc-500 uppercase tracking-wider block">Email</span>
            <span className="text-body text-zinc-200 font-medium break-all flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
              {customer.email}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-caption text-zinc-500 uppercase tracking-wider block">Phone</span>
            <span className="text-body text-zinc-200 font-medium flex items-center gap-1.5 tnum">
              <Phone className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
              {customer.phone || '—'}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-caption text-zinc-500 uppercase tracking-wider block">GSTIN / Tax ID</span>
            <span className="text-body font-mono text-primary-300 font-medium">
              {customer.tax_id || 'Not registered'}
            </span>
          </div>

          {customer.billing_address && (
            <div className="sm:col-span-3 pt-2 border-t border-white/[0.04]">
              <span className="text-caption text-zinc-500 uppercase tracking-wider block mb-1">
                Billing Address
              </span>
              <p className="text-caption text-zinc-300 flex items-start gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0 mt-0.5" />
                {customer.billing_address}
              </p>
            </div>
          )}
        </div>

        {/* Linked Subscriptions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-subheading text-zinc-100 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary-400" />
              Subscriptions ({subscriptions.length})
            </h3>
          </div>

          {subsQuery.isLoading ? (
            <div className="h-16 skeleton" />
          ) : subscriptions.length === 0 ? (
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.04] text-center text-caption text-zinc-500">
              No subscriptions active or past for this customer.
            </div>
          ) : (
            <div className="space-y-2">
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-body font-semibold text-zinc-200">{sub.number}</span>
                    <span className="text-caption text-zinc-400">{sub.plan_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-caption text-zinc-400 tnum">
                      Next bill: {formatDate(sub.next_billing_date)}
                    </span>
                    <StatusBadge status={sub.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Linked Invoices */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-subheading text-zinc-100 flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-400" />
              Invoices ({invoices.length})
            </h3>
          </div>

          {invoicesQuery.isLoading ? (
            <div className="h-16 skeleton" />
          ) : invoices.length === 0 ? (
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.04] text-center text-caption text-zinc-500">
              No invoices generated yet for this customer.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-body font-medium text-zinc-200">{inv.number}</span>
                    <span className="text-caption text-zinc-500">Due {formatDate(inv.due_date)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-body font-semibold text-zinc-100 tnum">
                      {formatMoney(inv.total)}
                    </span>
                    <StatusBadge status={inv.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-white/[0.08]">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
