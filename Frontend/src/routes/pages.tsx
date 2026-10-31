/**
 * Feature pages re-exported from src/features.
 */
export { DashboardPage } from '@/features/dashboard/DashboardPage';
export { SubscriptionsPage } from '@/features/subscriptions/SubscriptionsPage';
export { CustomersPage } from '@/features/customers/CustomersPage';
export { InvoicesPage } from '@/features/invoices/InvoicesPage';
export { PaymentsPage } from '@/features/payments/PaymentsPage';
export { UsersPage } from '@/features/users/UsersPage';
export { PortalSubscriptionsPage } from '@/features/portal/PortalSubscriptionsPage';
export { PortalInvoicesPage } from '@/features/portal/PortalInvoicesPage';

// ─── 404 Page ───

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
      <div className="text-center glass p-8 rounded-2xl max-w-md w-full border border-white/[0.08] shadow-card">
        <p className="text-display text-primary-400 font-bold mb-2">404</p>
        <h1 className="text-heading text-zinc-100 font-semibold mb-2">Page not found</h1>
        <p className="text-body text-zinc-400 mb-6">
          The page or contract view you&apos;re looking for does not exist or has been moved.
        </p>
        <a
          href="/app"
          className="inline-flex items-center px-4 py-2 rounded-lg btn-gradient text-white text-body font-medium shadow-glow-sm hover:shadow-glow transition-all"
        >
          Return to Dashboard
        </a>
      </div>
    </div>
  );
}
