'use client';

import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  deadline: string;
  className?: string;
}

export default function CountdownTimer({ deadline, className }: Props) {
  const [timeLeft, setTimeLeft] = useState<string>('--:--:--');
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const target = new Date(deadline).getTime();
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setIsOverdue(true);
        setTimeLeft('OVERDUE');
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  return (
    <div className={cn(
      "flex items-center gap-2 font-mono font-black text-sm",
      isOverdue ? "text-red-500" : "text-green-400",
      className
    )}>
      <Clock size={14} className={cn(!isOverdue && "animate-pulse")} />
      {timeLeft}
    </div>
  );
}
