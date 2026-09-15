import React from 'react';
import { useAuth } from '../context/AuthContext';
import DailyCashDepositSection from '../components/DailyCashDepositSection';

const getOutletName = (user) => {
  const n = String(user?.name || '').toLowerCase();
  if (n.includes('johar')) return 'Johar Town';
  if (n.includes('jail')) return 'Jail Road';
  if (n.includes('abbottabad')) return 'Abbottabad';
  return user?.name || 'Outlet';
};

const BankDepositPage = () => {
  const { user } = useAuth();
  const outlet = getOutletName(user);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <DailyCashDepositSection outlet={outlet} isOutletRole={true} />
    </div>
  );
};

export default BankDepositPage;
