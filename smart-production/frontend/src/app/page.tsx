'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';

export default function Home() {
  const router = useRouter();
  const { token, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
    const storedToken = localStorage.getItem('smart_prod_token');
    if (!storedToken) {
      router.push('/login');
    } else {
      router.push('/dashboard');
    }
  }, [router, checkAuth]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <h1 className="text-4xl font-black text-white italic tracking-tighter">SMART PROD</h1>
        <div className="h-1 w-32 bg-blue-600 rounded-full" />
      </div>
    </div>
  );
}
