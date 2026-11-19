import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { useT } from './lib/i18n.jsx';
import { LangToggle } from './components/Portal.jsx';
import AdminPortal from './portals/admin/AdminPortal.jsx';
import AhliPortal from './portals/ahli/AhliPortal.jsx';
import AmilPortal from './portals/amil/AmilPortal.jsx';

function Landing() {
  const t = useT();
  const cards = [
    { to: '/ahli', cls: 'portal-ahli', title: t('Portal Ahli', 'Member Portal'), items: [t('Kemas kini profil & tanggungan', 'Update profile & dependents'), t('Bayar yuran melalui QR', 'Pay fees via QR'), t('Lihat amil anda', 'See your amil')] },
    { to: '/amil', cls: 'portal-amil', title: t('Portal Amil', 'Collector Portal'), items: [t('Senarai ahli di bawah jagaan', 'Members under your care'), t('Rekod & kemas kini bayaran bulanan', 'Record & edit monthly payments'), t('Sahkan bayaran QR', 'Verify QR payments')] },
    { to: '/admin', cls: 'portal-admin', title: t('Portal Pentadbir', 'Admin Portal'), items: [t('Urus amil & ahli', 'Manage amil & members'), t('Bayaran khairat kepada waris', 'Payouts to next of kin'), t('Kedudukan kewangan', 'Financial standing')] }
  ];
  return (
    <div className="landing">
      <div className="landing-head">
        <div className="brand"><img src="/favicon.svg" alt="" width="36" height="36" /><span><strong>KhairatPlus</strong></span></div>
        <LangToggle />
      </div>
      <div className="hero">
        <h1>{t('Khairat Kematian', 'Bereavement Fund')}<br />Kampung Wakaf Mek Zainab</h1>
        <p>{t('Rekod ahli, kutipan yuran bulanan dan bayaran khairat di satu tempat. Pilih portal anda untuk log masuk.', 'Members, monthly collections and bereavement payouts in one place. Choose your portal to log in.')}</p>
      </div>
      <div className="portal-cards">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className={'portal-card ' + c.cls}>
            <h2>{c.title}</h2>
            <ul>{c.items.map((i) => <li key={i}>{i}</li>)}</ul>
            <span className="go">{t('Log masuk', 'Log in')} →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/admin/*" element={<AdminPortal />} />
      <Route path="/ahli/*" element={<AhliPortal />} />
      <Route path="/amil/*" element={<AmilPortal />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
