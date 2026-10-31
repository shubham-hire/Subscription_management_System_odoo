import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import type { Role } from '@/types';
import { Loader2 } from 'lucide-react';

interface RoleRouteProps {
  roles: Role[];
  children: React.ReactNode;
}

/**
 * Route guard that checks:
 * 1. User is authenticated (has a session)
 * 2. User's role is in the allowed roles list
 *
 * Shows a loading spinner while auth is initializing.
 * Redirects to /login if unauthenticated.
 * Shows 403 page if role doesn't match.
 */
export function RoleRoute({ roles, children }: RoleRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role)) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}

/**
 * Redirect helper: after login, sends user to the right landing page.
 */
export function AuthRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'customer') {
    return <Navigate to="/portal" replace />;
  }

  return <Navigate to="/app" replace />;
}

/**
 * Guest-only route: redirects authenticated users away from login/signup.
 */
export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (user) {
    if (user.role === 'customer') {
      return <Navigate to="/portal" replace />;
    }
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}

// ─── 403 Forbidden Page ───

function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <p className="text-display text-primary-600 mb-2">403</p>
        <h1 className="text-heading text-gray-900 mb-2">Access Denied</h1>
        <p className="text-body text-gray-500 mb-6">
          You don&apos;t have permission to access this page.
        </p>
        <a
          href="/"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-primary-600 text-white text-body font-medium hover:bg-primary-700"
        >
          Go back home
        </a>
      </div>
    </div>
  );
}
