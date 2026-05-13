import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-xl border border-line bg-surface/60 px-3.5 py-2 text-sm text-text placeholder:text-text-dim',
        'outline-none transition-all duration-200',
        'focus:border-accent/50 focus:bg-surface focus:ring-2 focus:ring-accent/20',
        'disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };
