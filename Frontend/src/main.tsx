import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '@/App';
import '@/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

// Dev diagnostics: capture uncaught render errors (invisible otherwise).
ReactDOM.createRoot(document.getElementById('root')!, {
  onUncaughtError: (error: unknown, info?: { componentStack?: string }) => {
    try {
      const arr = JSON.parse(sessionStorage.getItem('__renderErrs') || '[]');
      arr.push(
        String((error as Error)?.message ?? error).slice(0, 300) +
          ' :: ' +
          String(info?.componentStack ?? '')
            .split('\n')
            .slice(0, 8)
            .join(' | '),
      );
      sessionStorage.setItem('__renderErrs', JSON.stringify(arr.slice(-5)));
    } catch { /* ignore */ }
  },
} as never).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
