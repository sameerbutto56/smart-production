import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

const variants = {
  primary: 'btn-solid-primary',
  danger: 'btn-solid-danger',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  success: 'btn-solid-success',
  warning: 'btn-solid-warning',
};

const sizes = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
  xl: 'btn-xl',
};

const processingTexts = {
  'Send to': 'Sending Order...',
  'Dispatch': 'Processing Dispatch...',
  'Production': 'Sending to Production...',
  'Store': 'Sending to Store...',
  'Design': 'Sending to Design...',
  'Delete': 'Deleting...',
  'Save': 'Saving...',
  'Submit': 'Submitting...',
  'Approve': 'Approving...',
  'Reject': 'Rejecting...',
  'Confirm': 'Confirming...',
  'Mark': 'Updating...',
  'Route': 'Routing Order...',
  'Record': 'Recording...',
  'Upload': 'Uploading...',
};

function getProcessingText(children) {
  if (typeof children === 'string') {
    for (const [key, val] of Object.entries(processingTexts)) {
      if (children.includes(key)) return val;
    }
  }
  return 'Processing...';
}

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  loadingText,
  icon: Icon,
  iconPosition = 'left',
  type = 'button',
  onClick,
  ...props
}) => {
  const base = variants[variant] || variants.primary;
  const sz = sizes[size] || sizes.md;
  const processingMsg = loadingText || (loading ? getProcessingText(children) : '');
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={loading ? undefined : onClick}
      className={`${base} ${sz} ${className} ${loading ? 'opacity-70 cursor-not-allowed pointer-events-none' : ''}`}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center justify-center gap-2">
          <LoadingSpinner size={size === 'sm' ? 12 : 14} />
          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider">{processingMsg}</span>
        </span>
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon size={size === 'sm' ? 14 : size === 'md' ? 16 : 18} />}
          {children}
          {Icon && iconPosition === 'right' && <Icon size={size === 'sm' ? 14 : size === 'md' ? 16 : 18} />}
        </>
      )}
    </button>
  );
};

export default Button;
