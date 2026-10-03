import React, { lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import { useT } from './i18n/index.jsx';

import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import WhoAreYou from './pages/WhoAreYou.jsx';
import AppLayout from './components/AppLayout.jsx';
import DashboardRouter from './pages/dashboard/DashboardRouter.jsx';
import Account from './pages/account/Account.jsx';
import AcceptInvite from './pages/AcceptInvite.jsx';
import ReportsList from './pages/reports/ReportsList.jsx';
import SetupInProgress from './pages/onboarding/SetupInProgress.jsx';
import Library from './pages/library/Library.jsx';
import Inbox from './pages/inbox/Inbox.jsx';
import Thread from './pages/inbox/Thread.jsx';
import Notifications from './pages/inbox/Notifications.jsx';
import Logo from './components/Logo.jsx';
import PageLoadBoundary from './components/PageLoadBoundary.jsx';

// Screens used less often (the setup funnel, the Builder, Team, the report
// forms, a report's PDF page…) are downloaded when first opened: everything
// was one 560 KB script, all of it fetched before the first screen showed.
// Once the app is idle they're fetched anyway, so the service worker has
// them for later, offline use.
const lazyPage = (load) => Object.assign(lazy(load), { preload: load });
const ConfigureData = lazyPage(() => import('./pages/ConfigureData.jsx'));
const Pricing = lazyPage(() => import('./pages/Pricing.jsx'));
const Checkout = lazyPage(() => import('./pages/Checkout.jsx'));
const OnboardingWizard = lazyPage(() => import('./pages/onboarding/OnboardingWizard.jsx'));
const KpiDashboard = lazyPage(() => import('./pages/dashboard/KpiDashboard.jsx'));
const ChecklistBuilder = lazyPage(() => import('./pages/checklists/ChecklistBuilder.jsx'));
const ChecklistRun = lazyPage(() => import('./pages/checklists/ChecklistRun.jsx'));
const KitchenDailyForm = lazyPage(() => import('./pages/forms/KitchenDailyForm.jsx'));
const BarDailyForm = lazyPage(() => import('./pages/forms/BarDailyForm.jsx'));
const OpeningDailyForm = lazyPage(() => import('./pages/forms/OpeningDailyForm.jsx'));
const ClosingDailyForm = lazyPage(() => import('./pages/forms/ClosingDailyForm.jsx'));
const QcVisitForm = lazyPage(() => import('./pages/forms/QcVisitForm.jsx'));
const NfsaVisit = lazyPage(() => import('./pages/nfsa/NfsaVisit.jsx'));
const AreaManagerVisitForm = lazyPage(() => import('./pages/forms/AreaManagerVisitForm.jsx'));
const OpsManagerVisitForm = lazyPage(() => import('./pages/forms/OpsManagerVisitForm.jsx'));
const Team = lazyPage(() => import('./pages/team/Team.jsx'));
const ReportView = lazyPage(() => import('./pages/reports/ReportView.jsx'));
const SopDetail = lazyPage(() => import('./pages/library/SopDetail.jsx'));
const LAZY_PAGES = [ConfigureData, Pricing, Checkout, OnboardingWizard, KpiDashboard, ChecklistBuilder, ChecklistRun, KitchenDailyForm, BarDailyForm, OpeningDailyForm, ClosingDailyForm, QcVisitForm, NfsaVisit, AreaManagerVisitForm, OpsManagerVisitForm, Team, ReportView, SopDetail];

function usePreloadPages() {
  useEffect(() => {
    const run = () => LAZY_PAGES.forEach((page) => page.preload().catch(() => {}));
    const timer = setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(run, { timeout: 5000 }) : run()), 4000);
    return () => clearTimeout(timer);
  }, []);
}

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
      <span className="auth-brand"><Logo size={28} /></span>
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

// Pages for the roles that have them in the menu (and that the server
// accepts): typing the address as staff or a store manager opened a page
// whose every save was refused.
const MANAGER_ROLES = ['business_owner', 'operations_manager', 'area_manager'];
function ManagerOnly({ children }) {
  const { user } = useAuth();
  return user && !MANAGER_ROLES.includes(user.role) ? <Navigate to="/app/dashboard" replace /> : children;
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
  usePreloadPages();
  return (
    <>
    <ScrollToTop />
    <PageLoadBoundary>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
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
        <Route path="checklists" element={<ManagerOnly><ChecklistBuilder /></ManagerOnly>} />
        <Route path="checklists/run/:submissionId" element={<ChecklistRun />} />
        <Route path="forms/kitchen" element={<KitchenDailyForm />} />
        <Route path="forms/bar" element={<BarDailyForm />} />
        <Route path="forms/opening" element={<OpeningDailyForm />} />
        <Route path="forms/closing" element={<ClosingDailyForm />} />
        <Route path="forms/qc-visit" element={<ManagerOnly><QcVisitForm /></ManagerOnly>} />
        <Route path="nfsa" element={<StaffRedirect><NfsaVisit /></StaffRedirect>} />
        <Route path="forms/area-manager-visit" element={<ManagerOnly><AreaManagerVisitForm /></ManagerOnly>} />
        <Route path="forms/ops-manager-visit" element={<ManagerOnly><OpsManagerVisitForm /></ManagerOnly>} />
        <Route path="team" element={<ManagerOnly><Team /></ManagerOnly>} />
        <Route path="account" element={<Account />} />
        <Route path="reports" element={<ReportsList />} />
        <Route path="reports/:submissionId" element={<ReportView />} />
        <Route path="library" element={<Library />} />
        <Route path="library/:group" element={<SopDetail />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="inbox/:threadId" element={<Thread />} />
        <Route path="notifications" element={<Notifications />} />
        {/* An unknown address inside the app showed an empty page. */}
        <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
      </Route>

      {/* A mistyped or stale address sent signed-in staff to the marketing
          page; send them to their dashboard instead. */}
      <Route path="*" element={<NotFoundRedirect />} />
    </Routes>
    </PageLoadBoundary>
    </>
  );
}
