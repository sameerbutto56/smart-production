import React, { createContext, useContext, useState, useCallback } from 'react';

const EmployeeContext = createContext(null);

export const EmployeeProvider = ({ children }) => {
  const [activeEmployee, setActiveEmployee] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('activeEmployee')); } catch { return null; }
  });

  const login = useCallback((employee) => {
    setActiveEmployee(employee);
    sessionStorage.setItem('activeEmployee', JSON.stringify(employee));
  }, []);

  const logout = useCallback(() => {
    setActiveEmployee(null);
    sessionStorage.removeItem('activeEmployee');
  }, []);

  const isLoggedIn = !!activeEmployee;

  return (
    <EmployeeContext.Provider value={{ activeEmployee, login, logout, isLoggedIn }}>
      {children}
    </EmployeeContext.Provider>
  );
};

export const useEmployee = () => useContext(EmployeeContext);
