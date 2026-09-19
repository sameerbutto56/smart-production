import React from 'react';
import { ArrowLeft } from 'lucide-react';
import useAppBack from '../hooks/useAppBack';

const BackButton = ({
  onClick,
  label = 'Back',
  className = '',
  variant = 'default', // 'default' | 'compact' | 'pill'
}) => {
  const { goBack } = useAppBack();

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    } else {
      goBack();
    }
  };

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider bg-gray-800/80 hover:bg-gray-700 text-gray-200 hover:text-white border border-gray-700 shadow-sm transition-all active:scale-95 group ${className}`}
        title="Go back to previous screen"
      >
        <ArrowLeft size={14} className="text-gray-400 group-hover:text-white transition-transform group-hover:-translate-x-0.5" />
        <span>{label}</span>
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-gray-800/80 hover:bg-gray-700 text-gray-200 hover:text-white border border-gray-700 shadow-sm transition-all active:scale-95 group ${className}`}
        title="Go back to previous screen"
      >
        <ArrowLeft size={13} className="text-gray-400 group-hover:text-white transition-transform group-hover:-translate-x-0.5" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-gray-800/90 hover:bg-gray-700 text-gray-200 hover:text-white border border-gray-700/80 shadow-sm transition-all active:scale-95 group ${className}`}
      title="Go back to previous screen"
    >
      <ArrowLeft size={15} className="text-gray-400 group-hover:text-white transition-transform group-hover:-translate-x-0.5" />
      <span>{label}</span>
    </button>
  );
};

export default BackButton;
