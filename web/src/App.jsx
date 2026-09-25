import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import { useT } from './i18n/index.jsx';

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
import ReportsList from './pages/reports/ReportsList.jsx';
import ReportView from './pages/reports/ReportView.jsx';
import SetupInProgress from './pages/onboarding/SetupInProgress.jsx';

function RequireAuth({ children }) {
  const { user, loading, offline, refresh } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user && offline) return <OfflineScreen onRetry={refresh} />;
  // Remember where they were headed (e.g. a checklist reopened in Chrome
  // to get camera access) so logging in lands them back there.
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

// Signup, plan, checkout and the setup wizard belong to the people who
// run the business; staff invited mid-setup get a "setting up" message
// instead of screens they can't use.
const SETUP_ROLES = ['business_owner', 'operations_manager'];

function RequireSetupRole({ children }) {
  const { user } = useAuth();
  return <RequireAuth>{user && !SETUP_ROLES.includes(user.role) ? <SetupInProgress /> : children}</RequireAuth>;
}

// Shown instead of the login page when the saved session couldn't be
// checked because there's no connection — the login is still valid.
function OfflineScreen({ onRetry }) {
  const t = useT();
  const [trying, setTrying] = useState(false);
  const retry = async () => {
    setTrying(true);
    try { await onRetry(); } finally { setTrying(false); }
  };
  return (
    <div className="screen-narrow">
      <span className="auth-brand">SOPY</span>
      <div className="card">
        <h2>{t('offline.title')}</h2>
        <p>{t('offline.body')}</p>
        <button type="button" className="btn btn-primary" onClick={retry} disabled={trying}>
          {trying ? t('offline.trying') : t('common.tryAgain')}
        </button>
      </div>
    </div>
  );
}

// Pages that are for managers only; staff land on their dashboard instead
// of an "Insufficient permissions" error.
function StaffRedirect({ children }) {
  const { user } = useAuth();
  return user?.role === 'employee' ? <Navigate to="/app/dashboard" replace /> : children;
}

function NotFoundRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? '/app/dashboard' : '/'} replace />;
}

// A new page starts at the top. The router keeps the scroll position
// between pages, so e.g. "Get Started" at the bottom of the landing page
// opened the sign-up form already scrolled to its end.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
    <ScrollToTop />
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/get-started" element={<WhoAreYou />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />

      <Route path="/configure" element={<RequireSetupRole><ConfigureData /></RequireSetupRole>} />
      <Route path="/pricing" element={<RequireSetupRole><Pricing /></RequireSetupRole>} />
      <Route path="/checkout" element={<RequireSetupRole><Checkout /></RequireSetupRole>} />
      <Route path="/onboarding/*" element={<RequireSetupRole><OnboardingWizard /></RequireSetupRole>} />

      <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardRouter />} />
        <Route path="kpi" element={<StaffRedirect><KpiDashboard /></StaffRedirect>} />
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
        <Route path="reports" element={<ReportsList />} />
        <Route path="reports/:submissionId" element={<ReportView />} />
      </Route>

      {/* A mistyped or stale address sent signed-in staff to the marketing
          page; send them to their dashboard instead. */}
      <Route path="*" element={<NotFoundRedirect />} />
    </Routes>
    </>
  );
}
