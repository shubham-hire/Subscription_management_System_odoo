import { Outlet } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { adminNavConfig, portalNavConfig } from '@/lib/navigation';

/** Layout wrapper for admin/staff routes */
export function AdminLayout() {
  return (
    <AppShell navGroups={adminNavConfig}>
      <Outlet />
    </AppShell>
  );
}

/** Layout wrapper for customer portal routes */
export function PortalLayout() {
  return (
    <AppShell navGroups={portalNavConfig}>
      <Outlet />
    </AppShell>
  );
}
