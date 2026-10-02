import React from 'react';
import { LoadingSpinner, TableSkeleton, CardSkeleton, SkeletonLoader } from '../LoadingSpinner';

export { TableSkeleton, CardSkeleton, SkeletonLoader };

/**
 * Universal Dashboard Skeleton: Renders on initial dashboard mount
 * before any data has arrived.
 */
export function DashboardSkeleton({ 
  kpiCount = 4, 
  chartCount = 2, 
  hasTable = true,
  title = "Loading Dashboard..." 
}) {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Top Header / Filter Bar Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-gray-900/60 border border-gray-800/80">
        <div className="space-y-2">
          <div className="h-5 w-48 bg-gray-800 rounded-lg" />
          <div className="h-3 w-32 bg-gray-800/60 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 bg-gray-800 rounded-xl" />
          <div className="h-9 w-24 bg-gray-800 rounded-xl" />
          <div className="h-9 w-28 bg-gray-800 rounded-xl" />
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className={`grid grid-cols-2 md:grid-cols-${Math.min(kpiCount, 4)} gap-4`}>
        {Array.from({ length: kpiCount }).map((_, i) => (
          <div key={i} className="bg-gray-900/80 border border-gray-800/80 rounded-2xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-3.5 w-24 bg-gray-800 rounded" />
              <div className="h-8 w-8 bg-gray-800/80 rounded-xl" />
            </div>
            <div className="h-7 w-32 bg-gray-800/90 rounded-lg" />
            <div className="h-3 w-20 bg-gray-800/50 rounded" />
          </div>
        ))}
      </div>

      {/* Charts / Mid Section */}
      {chartCount > 0 && (
        <div className={`grid grid-cols-1 lg:grid-cols-${chartCount} gap-4`}>
          {Array.from({ length: chartCount }).map((_, i) => (
            <div key={i} className="bg-gray-900/80 border border-gray-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-4 w-36 bg-gray-800 rounded" />
                <div className="h-4 w-16 bg-gray-800/60 rounded" />
              </div>
              <div className="h-56 bg-gray-800/40 rounded-xl flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <LoadingSpinner size={24} className="text-blue-400" />
                  <span className="text-xs font-semibold text-gray-500">{title}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table / List Section */}
      {hasTable && (
        <div className="bg-gray-900/80 border border-gray-800/80 rounded-2xl p-5 space-y-3">
          <div className="h-4 w-40 bg-gray-800 rounded mb-4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800/40">
              <div className="h-4 w-28 bg-gray-800/70 rounded" />
              <div className="h-4 w-36 bg-gray-800/60 rounded" />
              <div className="h-4 w-20 bg-gray-800/60 rounded" />
              <div className="h-6 w-16 bg-gray-800/50 rounded-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Non-Blanking Section Overlay:
 * Wraps existing content. When `isUpdating` is true, keeps existing data visible
 * while showing a subtle translucent overlay and animated "Updating..." badge.
 * If data is completely absent and `isInitialLoading` is true, renders a clean skeleton.
 */
export function SectionOverlay({
  children,
  isUpdating = false,
  isInitialLoading = false,
  updatingText = "Updating...",
  skeletonComponent = null,
  className = ""
}) {
  if (isInitialLoading) {
    return skeletonComponent || (
      <div className="p-8 flex flex-col items-center justify-center bg-gray-900/60 border border-gray-800 rounded-2xl">
        <LoadingSpinner size={24} className="text-amber-400" />
        <span className="mt-2 text-xs font-bold text-gray-400 uppercase tracking-wider">{updatingText}</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Existing Content */}
      <div className={`transition-opacity duration-200 ${isUpdating ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
        {children}
      </div>

      {/* Non-blanking Floating Update Badge */}
      {isUpdating && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-950/20 backdrop-blur-[1px] rounded-2xl pointer-events-none">
          <div className="px-4 py-2 rounded-xl bg-gray-900/95 border border-amber-500/40 text-amber-300 text-xs font-bold shadow-2xl flex items-center gap-2.5 animate-pulse">
            <LoadingSpinner size={14} className="text-amber-400 shrink-0" />
            <span>{updatingText}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Universal Action Button with Double-Click Prevention and Auto-Loading State
 */
export function ActionButton({
  children,
  onClick,
  isLoading = false,
  loadingText = "Processing...",
  disabled = false,
  className = "",
  icon: Icon = null,
  variant = "primary", // primary, success, danger, outline, ghost
  type = "button",
  ...props
}) {
  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30";
      case "danger":
        return "bg-red-600 hover:bg-red-500 text-white border-red-500/30";
      case "outline":
        return "bg-gray-800/80 hover:bg-gray-700 text-gray-200 border-gray-700/80";
      case "ghost":
        return "bg-transparent hover:bg-gray-800 text-gray-300 border-transparent";
      case "primary":
      default:
        return "bg-blue-600 hover:bg-blue-500 text-white border-blue-500/30";
    }
  };

  const isBtnDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      onClick={isBtnDisabled ? undefined : onClick}
      disabled={isBtnDisabled}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-150 border shadow-sm select-none active:scale-95 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 ${getVariantStyles()} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <LoadingSpinner size={13} className="shrink-0 text-current" />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          {Icon && <Icon size={14} className="shrink-0" />}
          <span>{children}</span>
        </>
      )}
    </button>
  );
}

/**
 * Filter Loading Badge: Placed adjacent to date pickers, dropdowns, or search inputs
 */
export function FilterLoadingBadge({ text = "Applying filter..." }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold animate-pulse shadow-sm">
      <LoadingSpinner size={11} className="text-amber-400 shrink-0" />
      <span>{text}</span>
    </span>
  );
}

/**
 * Background Sync Badge: Discretely notifies that data is live or syncing
 */
export function BackgroundSyncBadge({ isSyncing = false, lastSyncedText = "" }) {
  if (isSyncing) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px] font-bold">
        <LoadingSpinner size={10} className="text-blue-400 shrink-0" />
        Syncing live data...
      </span>
    );
  }
  return null;
}
