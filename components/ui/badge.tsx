import * as React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outline' | 'success' | 'info' | 'warning' | 'danger';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        variant === 'default' && 'bg-accent/15 text-accent-soft border border-accent/20',
        variant === 'outline' && 'border border-line-2 text-text-soft',
        variant === 'success' && 'bg-success/12 text-success border border-success/20',
        variant === 'info' && 'bg-info/12 text-info border border-info/20',
        variant === 'warning' && 'bg-warning/12 text-warning border border-warning/20',
        variant === 'danger' && 'bg-danger/12 text-danger border border-danger/20',
        className
      )}
      {...props}
    />
  );
}

export { Badge };
