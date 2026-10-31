import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import { RoleRoute, GuestRoute, AuthRedirect } from '@/routes/guards';
import { AdminLayout, PortalLayout } from '@/routes/layouts';
import { LoginPage } from '@/features/auth/LoginPage';
import { SignupPage } from '@/features/auth/SignupPage';
import {
  DashboardPage,
  SubscriptionsPage,
  CustomersPage,
  InvoicesPage,
  PaymentsPage,
  UsersPage,
  PortalSubscriptionsPage,
  PortalInvoicesPage,
  NotFoundPage,
} from '@/routes/pages';
import {
  ProductsPage,
  PlansPage,
  TaxesPage,
  DiscountsPage,
} from '@/features/catalog';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          {/* Root redirect */}
          <Route path="/" element={<AuthRedirect />} />

          {/* Guest-only auth pages */}
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <GuestRoute>
                <SignupPage />
              </GuestRoute>
            }
          />

          {/* Admin/Staff routes */}
          <Route
            path="/app"
            element={
              <RoleRoute roles={['admin', 'staff']}>
                <AdminLayout />
              </RoleRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="subscriptions" element={<SubscriptionsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route
              path="products"
              element={
                <RoleRoute roles={['admin']}>
                  <ProductsPage />
                </RoleRoute>
              }
            />
            <Route
              path="plans"
              element={
                <RoleRoute roles={['admin']}>
                  <PlansPage />
                </RoleRoute>
              }
            />
            <Route
              path="taxes"
              element={
                <RoleRoute roles={['admin']}>
                  <TaxesPage />
                </RoleRoute>
              }
            />
            <Route
              path="discounts"
              element={
                <RoleRoute roles={['admin']}>
                  <DiscountsPage />
                </RoleRoute>
              }
            />
            <Route
              path="users"
              element={
                <RoleRoute roles={['admin']}>
                  <UsersPage />
                </RoleRoute>
              }
            />
          </Route>

          {/* Customer portal routes */}
          <Route
            path="/portal"
            element={
              <RoleRoute roles={['customer']}>
                <PortalLayout />
              </RoleRoute>
            }
          >
            <Route index element={<PortalSubscriptionsPage />} />
            <Route path="invoices" element={<PortalInvoicesPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
