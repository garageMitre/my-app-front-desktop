import * as React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline' | 'destructive' | 'soft';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200',
          'disabled:opacity-50 disabled:pointer-events-none select-none',
          'active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
          variant === 'default' &&
            'bg-accent text-white hover:bg-accent-soft shadow-[0_4px_24px_-6px_rgba(108,99,255,0.6)] hover:shadow-[0_6px_28px_-4px_rgba(108,99,255,0.7)]',
          variant === 'soft' &&
            'bg-accent/15 text-accent-soft hover:bg-accent/25 border border-accent/20',
          variant === 'ghost' &&
            'hover:bg-white/[0.06] text-text-soft hover:text-text',
          variant === 'outline' &&
            'border border-line-2 bg-white/[0.02] hover:bg-white/[0.05] text-text-soft hover:text-text',
          variant === 'destructive' &&
            'bg-danger/15 text-danger border border-danger/25 hover:bg-danger/25',
          size === 'default' && 'h-10 px-4 text-sm',
          size === 'sm' && 'h-8 px-3 text-xs',
          size === 'lg' && 'h-12 px-6 text-sm',
          size === 'icon' && 'h-10 w-10',
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
