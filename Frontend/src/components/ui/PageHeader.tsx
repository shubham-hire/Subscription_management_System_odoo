import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

/** Standard page title block with staggered entry */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6 animate-fade-up">
      <div>
        <h1 className="text-heading text-zinc-100">{title}</h1>
        {description && (
          <p className="mt-1 text-body text-zinc-500 max-w-[65ch]">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
