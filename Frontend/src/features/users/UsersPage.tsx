import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus,
  Shield,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';
import { getUsers, createStaff } from '@/api/domain';
import { ApiError } from '@/api/client';
import { staffSchema, type StaffFormValues, PASSWORD_RULES } from '@/lib/schemas';
import type { Role } from '@/types';
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
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

const ROLE_BADGES: Record<Role, { label: string; color: string; icon: React.ReactNode }> = {
  admin: {
    label: 'Admin',
    color: 'bg-purple-500/10 border-purple-500/25 text-purple-300 shadow-glow-sm',
    icon: <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />,
  },
  staff: {
    label: 'Staff (Sales / Ops)',
    color: 'bg-primary-500/10 border-primary-500/25 text-primary-300',
    icon: <Shield className="h-3.5 w-3.5 text-primary-400" />,
  },
  customer: {
    label: 'Customer Portal',
    color: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
    icon: <UserCheck className="h-3.5 w-3.5 text-emerald-400" />,
  },
};

export function UsersPage() {
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['users', page],
    queryFn: () => getUsers({ page, page_size: pageSize }),
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  const watchPassword = watch('password', '');

  const openCreateDialog = () => {
    reset({
      name: '',
      email: '',
      password: '',
    });
    setIsCreateOpen(true);
  };

  const closeCreateDialog = () => {
    setIsCreateOpen(false);
    reset();
  };

  const createMutation = useMutation({
    mutationFn: createStaff,
    onSuccess: (newUser) => {
      toast('success', `Staff member ${newUser.name} created.`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeCreateDialog();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fields) {
        Object.entries(err.fields).forEach(([f, msg]) => {
          setError(f as keyof StaffFormValues, { message: msg });
        });
      } else {
        toast('error', err instanceof Error ? err.message : 'Failed to create staff member.');
      }
    },
  });

  const onSubmit = (values: StaffFormValues) => {
    createMutation.mutate({
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      password: values.password,
    });
  };

  return (
    <div>
      <PageHeader
        title="Users & Permissions"
        description="Role-based access controls for Admin, Sales/Billing Staff, and Customer Portal accounts."
        actions={
          <Button onClick={openCreateDialog} variant="primary">
            <Plus className="h-4 w-4" />
            Add Staff Member
          </Button>
        }
      />

      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>User Name</TableHeader>
              <TableHeader>Email</TableHeader>
              <TableHeader>Role</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Access Scope</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && <TableSkeleton columns={5} rows={6} />}

            {isError && (
              <TableError
                columns={5}
                message={error instanceof Error ? error.message : 'Failed to load users.'}
                onRetry={() => refetch()}
              />
            )}

            {!isLoading && !isError && data?.items.length === 0 && (
              <TableEmpty
                columns={5}
                title="No users found"
                description="Create staff members to manage sales and billing."
                action={
                  <Button variant="primary" size="sm" onClick={openCreateDialog}>
                    <Plus className="h-4 w-4" />
                    Add Staff Member
                  </Button>
                }
              />
            )}

            {!isLoading &&
              !isError &&
              data?.items.map((u) => {
                const badge = ROLE_BADGES[u.role] ?? {
                  label: u.role,
                  color: 'bg-white/[0.04] text-zinc-300',
                  icon: null,
                };

                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center font-semibold text-caption text-zinc-200">
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-zinc-100">{u.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-zinc-300 font-mono text-caption">{u.email}</span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-semibold border ${badge.color}`}
                      >
                        {badge.icon}
                        {badge.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-caption text-emerald-400 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Active
                      </span>
                    </TableCell>
                    <TableCell className="text-caption text-zinc-400">
                      {u.role === 'admin' && 'Full system, catalog pricing, and user admin'}
                      {u.role === 'staff' && 'Customer onboarding, subscriptions, billing run, payments'}
                      {u.role === 'customer' && 'Self-service portal (own contracts & invoices only)'}
                    </TableCell>
                  </TableRow>
                );
              })}
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

      {/* ─── Create Staff Modal ─── */}
      <Dialog
        open={isCreateOpen}
        onClose={closeCreateDialog}
        title="Create Staff Member"
        description="Add a team operator with operational access to subscriptions, billing runs, and payments."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Full Name" error={errors.name?.message} required>
            <Input
              {...register('name')}
              placeholder="e.g. Priya Sharma"
              hasError={!!errors.name}
            />
          </Field>

          <Field label="Work Email" error={errors.email?.message} required>
            <Input
              type="email"
              {...register('email')}
              placeholder="priya@brightloop.dev"
              hasError={!!errors.email}
            />
          </Field>

          <Field
            label="Initial Password"
            error={errors.password?.message}
            hint="Enforced: 9+ chars, uppercase, lowercase, and special symbol"
            required
          >
            <Input
              type="password"
              {...register('password')}
              placeholder="••••••••••••"
              hasError={!!errors.password}
            />
          </Field>

          {/* Live password checklist */}
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1.5">
            <span className="text-caption font-semibold text-zinc-400 block mb-1">
              Security Requirements:
            </span>
            {PASSWORD_RULES.map((rule) => {
              const passed = rule.test(watchPassword);
              return (
                <div key={rule.id} className="flex items-center gap-2 text-caption">
                  <CheckCircle2
                    className={`h-3.5 w-3.5 ${
                      passed ? 'text-emerald-400' : 'text-zinc-600'
                    }`}
                  />
                  <span className={passed ? 'text-zinc-300' : 'text-zinc-500'}>
                    {rule.label}
                  </span>
                </div>
              );
            })}
          </div>

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
              Create Staff Account
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
