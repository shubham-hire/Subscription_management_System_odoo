import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, ChevronDown, Zap } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import type { NavGroup } from '@/lib/navigation';

interface AppShellProps {
  navGroups: NavGroup[];
  children: React.ReactNode;
}

export function AppShell({ navGroups, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        user ? item.roles.includes(user.role) : false,
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen flex">
      {/* ─── Mobile backdrop ─── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm animate-fade-in lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ─── Sidebar ─── */}
      <aside
        data-print-hide
        className={`
          fixed inset-y-0 left-0 z-40
          w-64 bg-surface-900/80 backdrop-blur-xl border-r border-white/[0.06]
          flex flex-col
          transition-transform duration-250 ease-out-expo
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Brand */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-white/[0.06]">
          <div className="h-8 w-8 rounded-lg btn-gradient flex items-center justify-center shadow-glow-sm">
            <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <span className="font-semibold text-subheading text-zinc-100 tracking-tight block leading-tight">
              Brightloop
            </span>
            <span className="text-caption text-zinc-500 leading-tight">
              Subscription OS
            </span>
          </div>
          <button
            className="ml-auto lg:hidden p-1 rounded-lg hover:bg-white/[0.06] transition-colors active:scale-95"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {filteredGroups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-6' : ''}>
              {group.label && (
                <p className="px-3 mb-2 text-caption font-semibold text-zinc-600 uppercase tracking-wider">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    item.path === '/app' || item.path === '/portal'
                      ? location.pathname === item.path
                      : location.pathname.startsWith(item.path);
                  const Icon = item.icon;

                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`
                          group relative flex items-center gap-3 px-3 py-2 rounded-lg text-body font-medium
                          transition-all duration-150 ease-out-expo
                          ${
                            isActive
                              ? 'border-glow bg-primary-500/10 text-primary-300'
                              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100'
                          }
                        `}
                      >
                        {/* Active glow bar on the left edge */}
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-primary-400 shadow-glow-sm"
                          />
                        )}
                        <Icon
                          className={`h-[18px] w-[18px] flex-shrink-0 transition-colors duration-150 ${
                            isActive
                              ? 'text-primary-400'
                              : 'text-zinc-500 group-hover:text-zinc-300'
                          }`}
                        />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Sidebar footer — environment badge */}
        <div className="p-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-caption text-zinc-400">Live API · local</span>
          </div>
        </div>
      </aside>

      {/* ─── Main area ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header
          data-print-hide
          className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-white/[0.06] bg-surface-950/60 backdrop-blur-xl sticky top-0 z-20"
        >
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-white/[0.06] transition-colors active:scale-95"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5 text-zinc-300" />
          </button>

          <div className="flex-1" />

          {user && (
            <UserMenu name={user.name} email={user.email} role={user.role} onLogout={logout} />
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

// ─── User menu dropdown ───

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  staff: 'Staff',
  customer: 'Customer',
};

function UserMenu({
  name,
  email,
  role,
  onLogout,
}: {
  name: string;
  email: string;
  role: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 p-1.5 pr-2 rounded-lg hover:bg-white/[0.06] transition-colors active:scale-[0.98]"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <div className="h-8 w-8 rounded-full btn-gradient flex items-center justify-center shadow-glow-sm flex-shrink-0">
          <span className="text-white font-semibold text-caption">
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
        <span className="hidden sm:block text-body font-medium text-zinc-200">
          {name}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-zinc-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 mt-2 w-60 z-50 glass glass-edge rounded-xl shadow-dialog py-1 animate-scale-in">
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <p className="text-body font-medium text-zinc-100">{name}</p>
              <p className="text-caption text-zinc-500 truncate">{email}</p>
              <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-primary-500/10 border border-primary-500/25 text-caption text-primary-300">
                {ROLE_LABELS[role] ?? role}
              </span>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-body text-zinc-300 hover:bg-white/[0.05] hover:text-zinc-100 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
