import { useEffect, useState } from 'react';
import { auth, setToken } from '../api/client';
import type { AuthUser } from '../api/client';

/** Demo dashboard shell — Dev C replaces mock KPIs with live /reports/summary. */
export default function Dashboard() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    auth.me().then(setUser).catch(() => setToken(null));
  }, []);

  const kpis = [
    { label: 'Active subscriptions', value: '412', color: 'text-green-600' },
    { label: 'Revenue collected', value: '₹8,42,300', color: 'text-gray-900' },
    { label: 'Outstanding', value: '₹1,13,750', color: 'text-amber-600' },
    { label: 'Overdue invoices', value: '9', color: 'text-red-600' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <span className="font-semibold text-gray-900">
          Brightloop <span className="text-indigo-600">SMS</span>
        </span>
        <div className="flex items-center gap-4 text-sm">
          {user && (
            <span className="text-gray-600">
              {user.name} · <span className="uppercase">{user.role}</span>
            </span>
          )}
          <button
            onClick={() => {
              setToken(null);
              location.reload();
            }}
            className="rounded-lg border px-3 py-1 hover:bg-gray-50"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
        <p className="mb-6 text-sm text-gray-500">Mock data — wire to GET /reports/summary</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">{k.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
