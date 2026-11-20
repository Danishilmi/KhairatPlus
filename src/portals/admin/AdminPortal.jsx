import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Portal, AccountSecurity } from '../../components/Portal.jsx';
import { useT } from '../../lib/i18n.jsx';
import Dashboard from './Dashboard.jsx';
import Amils from './Amils.jsx';
import Members from './Members.jsx';
import Payouts from './Payouts.jsx';
import Finance from './Finance.jsx';
import Settings from './Settings.jsx';
import Admins from './Admins.jsx';

export default function AdminPortal() {
  const t = useT();
  const tabs = [
    { to: '/admin', end: true, label: t('Papan pemuka', 'Dashboard') },
    { to: '/admin/ahli', label: t('Ahli', 'Members') },
    { to: '/admin/amil', label: 'Amil' },
    { to: '/admin/khairat', label: t('Bayaran khairat', 'Payouts') },
    { to: '/admin/kewangan', label: t('Kewangan', 'Finance') },
    { to: '/admin/pentadbir', label: t('Pentadbir', 'Admins') },
    { to: '/admin/tetapan', label: t('Tetapan', 'Settings') }
  ];
  return (
    <Portal role="admin" accent="admin" title={t('Portal Pentadbir', 'Admin Portal')} tabs={tabs}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="ahli" element={<Members />} />
        <Route path="amil" element={<Amils />} />
        <Route path="khairat" element={<Payouts />} />
        <Route path="kewangan" element={<Finance />} />
        <Route path="pentadbir" element={<Admins />} />
        <Route path="tetapan" element={<><Settings /><AccountSecurity /></>} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Portal>
  );
}
