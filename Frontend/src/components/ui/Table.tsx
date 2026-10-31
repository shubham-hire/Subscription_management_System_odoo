import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ─── Table Root ───

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-body text-left tnum ${className}`}>
        {children}
      </table>
    </div>
  );
}

// ─── Sub-components ───

export function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-white/[0.08] bg-white/[0.02]">
      {children}
    </thead>
  );
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-white/[0.05]">{children}</tbody>;
}

export function TableRow({
  children,
  className = '',
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLTableRowElement>) => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={`transition-colors duration-100 hover:bg-white/[0.03] ${className}`}
    >
      {children}
    </tr>
  );
}

export function TableHeader({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-caption font-semibold text-zinc-500 uppercase tracking-wider ${className}`}
    >
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 text-zinc-300 ${className}`}>{children}</td>;
}

// ─── Loading Skeleton ───

interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

export function TableSkeleton({ columns, rows = 5 }: TableSkeletonProps) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <TableRow key={rowIdx}>
          {Array.from({ length: columns }).map((_, colIdx) => (
            <TableCell key={colIdx}>
              <div className="h-4 skeleton" style={{ opacity: 1 - rowIdx * 0.12 }} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}

// ─── Empty State ───

interface TableEmptyProps {
  columns: number;
  message?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function TableEmpty({
  columns,
  message,
  title = 'No data found.',
  description,
  action,
}: TableEmptyProps) {
  return (
    <TableBody>
      <tr>
        <td colSpan={columns} className="px-4 py-16 text-center text-zinc-500">
          <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
            <div className="h-4 w-4 rounded border border-dashed border-zinc-600" />
          </div>
          <p className="text-body text-zinc-300 font-medium">{message || title}</p>
          {description && (
            <p className="mt-1 text-caption text-zinc-500 max-w-sm mx-auto">{description}</p>
          )}
          {action && <div className="mt-4 flex justify-center">{action}</div>}
        </td>
      </tr>
    </TableBody>
  );
}

// ─── Error State ───

interface TableErrorProps {
  columns: number;
  message?: string;
  onRetry?: () => void;
}

export function TableError({
  columns,
  message = 'Failed to load data.',
  onRetry,
}: TableErrorProps) {
  return (
    <TableBody>
      <tr>
        <td colSpan={columns} className="px-4 py-16 text-center">
          <p className="text-red-400 mb-3">{message}</p>
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </td>
      </tr>
    </TableBody>
  );
}

// ─── Pagination ───

interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
}: TablePaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
      <p className="text-caption text-zinc-500">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 text-caption text-zinc-400 tnum">
          {page} / {totalPages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
