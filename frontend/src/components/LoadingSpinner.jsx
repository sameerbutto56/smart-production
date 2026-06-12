import React from 'react';

export function LoadingSpinner({ size = 16, className = '', text = '', inline = false }) {
  const spinner = (
    <svg
      className={`animate-spin ${inline ? 'inline-block' : ''} ${className}`}
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  if (!text) return spinner;
  return (
    <span className="inline-flex items-center gap-2">
      {spinner}
      <span className="text-xs md:text-sm font-bold uppercase tracking-wider">{text}</span>
    </span>
  );
}

export function PageLoader({ text = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size={32} />
        <p className="text-xs font-bold theme-text-muted uppercase tracking-widest">{text}</p>
      </div>
    </div>
  );
}

export function SkeletonLoader({ rows = 4, className = '' }) {
  return (
    <div className={`space-y-3 p-4 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse flex gap-3">
          <div className="h-3 w-3 rounded-full bg-gray-700" />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 rounded bg-gray-700/60 w-full" />
            <div className="h-2 rounded bg-gray-700/40 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="theme-bg rounded-2xl p-4 animate-pulse space-y-3 border border-gray-800/50">
      <div className="flex justify-between items-start">
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-gray-700/60 rounded w-1/3" />
          <div className="h-3 bg-gray-700/40 rounded w-1/2" />
        </div>
        <div className="h-6 w-16 bg-gray-700/40 rounded-full" />
      </div>
      <div className="h-3 bg-gray-700/30 rounded w-full" />
      <div className="h-3 bg-gray-700/30 rounded w-2/3" />
      <div className="flex gap-2">
        <div className="h-8 bg-gray-700/40 rounded-xl flex-1" />
        <div className="h-8 bg-gray-700/40 rounded-xl flex-1" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="animate-pulse space-y-2 p-2">
      <div className="flex gap-3 mb-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 bg-gray-700/50 rounded flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-5 bg-gray-700/30 rounded flex-1"
              style={{ width: `${30 + Math.random() * 40}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
