import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'neutral', className = '', size = 'md' }: BadgeProps) {
  const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    danger: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    info: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
    neutral: 'bg-slate-800 text-slate-300 border border-slate-700',
    brand: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 font-medium rounded-md',
    md: 'text-xs px-2.5 py-1 font-semibold rounded-full',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  switch (status?.toUpperCase()) {
    case 'PAID':
    case 'VERIFIED':
    case 'ACTIVE':
    case 'AVAILABLE':
      return <Badge variant="success" className={className}>{status}</Badge>;
    case 'PENDING':
    case 'PENDING_REVIEW':
    case 'NOTICE_PERIOD':
      return <Badge variant="warning" className={className}>{status.replace('_', ' ')}</Badge>;
    case 'SUBMITTED':
      return <Badge variant="info" className={className}>SUBMITTED</Badge>;
    case 'OVERDUE':
    case 'FULL':
    case 'OCCUPIED':
    case 'REJECTED':
      return <Badge variant="danger" className={className}>{status}</Badge>;
    case 'MAINTENANCE':
    case 'VACATED':
    case 'CHECKED_OUT':
    case 'CHECKED OUT':
      return <Badge variant="neutral" className={className}>{status.replace('_', ' ')}</Badge>;
    default:
      return <Badge variant="neutral" className={className}>{status || 'UNKNOWN'}</Badge>;
  }
}

export function PaymentStatusBadge({ status }: { status: string }) {
  switch (status?.toUpperCase()) {
    case 'PAID':
      return <Badge variant="success">PAID</Badge>;
    case 'PENDING':
      return <Badge variant="warning">PENDING</Badge>;
    case 'OVERDUE':
      return <Badge variant="danger">OVERDUE</Badge>;
    case 'REJECTED':
      return <Badge variant="danger">REJECTED</Badge>;
    case 'SUBMITTED':
      return <Badge variant="info">SUBMITTED</Badge>;
    default:
      return <Badge variant="neutral">{status || 'NOT GENERATED'}</Badge>;
  }
}
