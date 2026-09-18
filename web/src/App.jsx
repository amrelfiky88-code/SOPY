import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';

import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import WhoAreYou from './pages/WhoAreYou.jsx';
import ConfigureData from './pages/ConfigureData.jsx';
import Pricing from './pages/Pricing.jsx';
import Checkout from './pages/Checkout.jsx';
import OnboardingWizard from './pages/onboarding/OnboardingWizard.jsx';
import AppLayout from './components/AppLayout.jsx';
import DashboardRouter from './pages/dashboard/DashboardRouter.jsx';
import KpiDashboard from './pages/dashboard/KpiDashboard.jsx';
import ChecklistBuilder from './pages/checklists/ChecklistBuilder.jsx';
import ChecklistRun from './pages/checklists/ChecklistRun.jsx';
import KitchenDailyForm from './pages/forms/KitchenDailyForm.jsx';
import BarDailyForm from './pages/forms/BarDailyForm.jsx';
import OpeningDailyForm from './pages/forms/OpeningDailyForm.jsx';
import ClosingDailyForm from './pages/forms/ClosingDailyForm.jsx';
import QcVisitForm from './pages/forms/QcVisitForm.jsx';
import AreaManagerVisitForm from './pages/forms/AreaManagerVisitForm.jsx';
import OpsManagerVisitForm from './pages/forms/OpsManagerVisitForm.jsx';
import Team from './pages/team/Team.jsx';
import Account from './pages/account/Account.jsx';
import AcceptInvite from './pages/AcceptInvite.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  // Remember where they were headed (e.g. a checklist reopened in Chrome
  // to get camera access) so logging in lands them back there.
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/get-started" element={<WhoAreYou />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />

      <Route path="/configure" element={<RequireAuth><ConfigureData /></RequireAuth>} />
      <Route path="/pricing" element={<RequireAuth><Pricing /></RequireAuth>} />
      <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
      <Route path="/onboarding/*" element={<RequireAuth><OnboardingWizard /></RequireAuth>} />

      <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardRouter />} />
        <Route path="kpi" element={<KpiDashboard />} />
        <Route path="checklists" element={<ChecklistBuilder />} />
        <Route path="checklists/run/:submissionId" element={<ChecklistRun />} />
        <Route path="forms/kitchen" element={<KitchenDailyForm />} />
        <Route path="forms/bar" element={<BarDailyForm />} />
        <Route path="forms/opening" element={<OpeningDailyForm />} />
        <Route path="forms/closing" element={<ClosingDailyForm />} />
        <Route path="forms/qc-visit" element={<QcVisitForm />} />
        <Route path="forms/area-manager-visit" element={<AreaManagerVisitForm />} />
        <Route path="forms/ops-manager-visit" element={<OpsManagerVisitForm />} />
        <Route path="team" element={<Team />} />
        <Route path="account" element={<Account />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
