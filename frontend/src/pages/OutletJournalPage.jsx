import React from 'react';
import OutletJournal from '../components/OutletJournal';
import { useAuth } from '../context/AuthContext';

const getOutletName = (user) => {
  const n = String(user?.name || '').toLowerCase();
  if (n.includes('johar')) return 'Johar Town';
  if (n.includes('jail')) return 'Jail Road';
  if (n.includes('abbottabad')) return 'Abbottabad';
  return user?.name || 'Outlet';
};

const OutletJournalPage = () => {
  const { user } = useAuth();
  const outlet = getOutletName(user);
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl shadow-lg shadow-emerald-600/20">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">General Entries</h1>
          <p className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase">{outlet}</p>
        </div>
      </div>
      <OutletJournal outlet={outlet} />
    </div>
  );
};

export default OutletJournalPage;
