'use client';

import React, { ReactNode } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Truck, 
  Settings, 
  LogOut, 
  User,
  Activity,
  History
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Props {
  children: ReactNode;
}

export default function DashboardLayout({ children }: Props) {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
    { icon: Activity, label: 'Active Pipeline', href: '/dashboard/pipeline' },
    { icon: History, label: 'Audit Logs', href: '/dashboard/logs' },
    { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-900 flex flex-col">
        <div className="p-8">
          <h1 className="text-2xl font-black text-white italic tracking-tighter">SMART PROD</h1>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-900 transition-all text-sm font-bold text-slate-400 hover:text-white"
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-900">
          <div className="flex items-center gap-3 p-4 bg-slate-900 rounded-2xl mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white text-lg">
              {user?.name?.[0]}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-black truncate text-white">{user?.name}</p>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest truncate">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <button 
            onClick={() => { logout(); router.push('/login'); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all text-xs font-bold uppercase tracking-widest"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-fixed">
        {children}
      </main>
    </div>
  );
}
