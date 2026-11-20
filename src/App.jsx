import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/Login.jsx';
import AdminPortal from './portals/admin/AdminPortal.jsx';
import AhliPortal from './portals/ahli/AhliPortal.jsx';
import AmilPortal from './portals/amil/AmilPortal.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/admin/*" element={<AdminPortal />} />
      <Route path="/ahli/*" element={<AhliPortal />} />
      <Route path="/amil/*" element={<AmilPortal />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
