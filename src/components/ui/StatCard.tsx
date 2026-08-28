import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  accentColor?: 'brand' | 'emerald' | 'sky' | 'rose' | 'amber' | 'purple';
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accentColor = 'brand',
}: StatCardProps) {
  const colorMap = {
    brand: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    sky: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-lg shadow-black/20 hover:border-slate-700 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl border ${colorMap[accentColor]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {trend && (
        <div className="mt-4 flex items-center text-xs">
          <span
            className={`font-semibold ${
              trend.isPositive ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {trend.value}
          </span>
          <span className="text-slate-500 ml-1.5">vs last month</span>
        </div>
      )}
    </div>
  );
}
