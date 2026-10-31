import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  FileText,
  CreditCard,
  Package,
  Layers,
  Percent,
  Tag,
  Settings,
  ClipboardList,
  Receipt,
} from 'lucide-react';
import type { Role } from '@/types';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles: Role[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Single config array that drives the admin/staff sidebar.
 * Each item includes the roles that can see it.
 */
export const adminNavConfig: NavGroup[] = [
  {
    label: '',
    items: [
      { label: 'Dashboard', path: '/app', icon: LayoutDashboard, roles: ['admin', 'staff'] },
    ],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Subscriptions', path: '/app/subscriptions', icon: ShoppingCart, roles: ['admin', 'staff'] },
      { label: 'Customers', path: '/app/customers', icon: Users, roles: ['admin', 'staff'] },
    ],
  },
  {
    label: 'Billing',
    items: [
      { label: 'Invoices', path: '/app/invoices', icon: FileText, roles: ['admin', 'staff'] },
      { label: 'Payments', path: '/app/payments', icon: CreditCard, roles: ['admin', 'staff'] },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Products', path: '/app/products', icon: Package, roles: ['admin'] },
      { label: 'Plans', path: '/app/plans', icon: Layers, roles: ['admin'] },
      { label: 'Taxes', path: '/app/taxes', icon: Percent, roles: ['admin'] },
      { label: 'Discounts', path: '/app/discounts', icon: Tag, roles: ['admin'] },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Users', path: '/app/users', icon: Settings, roles: ['admin'] },
    ],
  },
];

/**
 * Portal nav for customer role — simple flat list.
 */
export const portalNavConfig: NavGroup[] = [
  {
    label: '',
    items: [
      { label: 'My Subscriptions', path: '/portal', icon: ClipboardList, roles: ['customer'] },
      { label: 'My Invoices', path: '/portal/invoices', icon: Receipt, roles: ['customer'] },
    ],
  },
];
