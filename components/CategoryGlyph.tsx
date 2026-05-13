'use client';
import * as React from 'react';
import { getCategoryIcon } from '@/lib/category-icons';
import { cn } from '@/lib/utils';

export function CategoryGlyph({
  name,
  color = '#6C63FF',
  size = 'md',
  className,
}: {
  name?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const Icon = getCategoryIcon(name);
  const dim = {
    sm: { box: 'w-7 h-7 rounded-lg',    icon: 'w-3.5 h-3.5', stroke: 2 },
    md: { box: 'w-9 h-9 rounded-xl',    icon: 'w-4 h-4',     stroke: 2 },
    lg: { box: 'w-12 h-12 rounded-2xl', icon: 'w-5 h-5',     stroke: 1.8 },
    xl: { box: 'w-16 h-16 rounded-2xl', icon: 'w-7 h-7',     stroke: 1.8 },
  }[size];

  return (
    <div
      className={cn(
        dim.box,
        'flex items-center justify-center flex-shrink-0 relative overflow-hidden',
        className,
      )}
      style={{
        backgroundColor: color + '1a',
        boxShadow: `inset 0 0 0 1px ${color}33`,
      }}
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{ background: `radial-gradient(circle at 30% 20%, ${color}55, transparent 70%)` }}
      />
      <Icon className={cn(dim.icon, 'relative z-10')} style={{ color }} strokeWidth={dim.stroke} />
    </div>
  );
}
