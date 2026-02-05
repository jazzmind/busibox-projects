'use client';

import { cn } from '@jazzmind/busibox-app/lib/utils';

interface ProgressBarProps {
  /** Progress value (0-100) */
  value: number;
  /** Optional label to show */
  label?: string;
  /** Show percentage text */
  showPercentage?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Color variant based on status */
  variant?: 'default' | 'success' | 'warning' | 'danger';
  /** Additional CSS classes */
  className?: string;
}

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

const variantClasses = {
  default: 'bg-blue-600 dark:bg-blue-500',
  success: 'bg-green-600 dark:bg-green-500',
  warning: 'bg-amber-500 dark:bg-amber-400',
  danger: 'bg-red-600 dark:bg-red-500',
};

export function ProgressBar({
  value,
  label,
  showPercentage = false,
  size = 'md',
  variant = 'default',
  className,
}: ProgressBarProps) {
  const normalizedValue = Math.max(0, Math.min(100, value));

  return (
    <div className={cn('w-full', className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1">
          {label && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {label}
            </span>
          )}
          {showPercentage && (
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {normalizedValue}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          'w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden',
          sizeClasses[size]
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            variantClasses[variant]
          )}
          style={{ width: `${normalizedValue}%` }}
          role="progressbar"
          aria-valuenow={normalizedValue}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

interface CheckpointProgressProps {
  /** Overall progress (0-100) */
  overallProgress: number;
  /** Progress to next checkpoint (0-100) */
  checkpointProgress: number;
  /** Checkpoint name */
  checkpointName?: string;
  /** Checkpoint due date */
  checkpointDate?: string;
  /** Additional CSS classes */
  className?: string;
}

export function CheckpointProgress({
  overallProgress,
  checkpointProgress,
  checkpointName,
  checkpointDate,
  className,
}: CheckpointProgressProps) {
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Overall Progress */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Overall Progress
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {overallProgress}%
          </span>
        </div>
        <ProgressBar value={overallProgress} size="md" variant="default" />
      </div>

      {/* Checkpoint Progress */}
      {checkpointName && (
        <div>
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Next:
              </span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {checkpointName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {checkpointDate && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(checkpointDate)}
                </span>
              )}
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {checkpointProgress}%
              </span>
            </div>
          </div>
          <ProgressBar
            value={checkpointProgress}
            size="sm"
            variant={checkpointProgress >= 100 ? 'success' : 'default'}
          />
        </div>
      )}
    </div>
  );
}
