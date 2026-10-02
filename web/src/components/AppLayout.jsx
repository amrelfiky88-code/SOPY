import React, { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useT } from '../i18n/index.jsx';
import FeedbackButton from './FeedbackButton.jsx';
import { InboxBadgeProvider, useInboxBadges } from './inboxBadges.jsx';
import { useLibraryNames } from '../lib/groupNames.js';
import SetupInProgress from '../pages/onboarding/SetupInProgress.jsx';
import Logo from './Logo.jsx';
import {
  FileTextIcon,
  GridIcon,
  BarChartIcon,
  StoveIcon,
  CoffeeIcon,
  ClipboardCheckIcon,
  ShieldIcon,
  StorefrontIcon,
  LogOutIcon,
  DoorOpenIcon,
  DoorClosedIcon,
  SearchIcon,
  MapPinIcon,
  BriefcaseIcon,
  UserIcon,
  LayersIcon,
  MessageIcon,
  BellIcon,
  ChevronStartIcon,
} from './icons.jsx';

// Roles allowed to run the signup funnel (the server enforces the same).
const SETUP_ROLES = ['business_owner', 'operations_manager'];

const STEP_TO_PATH = {
  who_are_you: '/get-started',
  configure_data: '/configure',
  pricing: '/pricing',
  checkout: '/checkout',
  onboarding: '/onboarding',
};

export default function AppLayout() {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close the drawer automatically whenever the route changes, so
  // tapping a nav link on mobile doesn't leave it open over the new page.
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // While the drawer is open, stop the page behind it scrolling (iOS
  // scrolls the body through the backdrop) and let Escape close it.
  useEffect(() => {
    if (!sidebarOpen) return undefined;
    document.documentElement.classList.add('scroll-locked');
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.classList.remove('scroll-locked');
      document.removeEventListener('keydown', onKey);
    };
  }, [sidebarOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (tenant && tenant.onboarding_step !== 'complete') {
    // Only the roles that can actually complete setup go through the
    // funnel; staff invited early would otherwise land in the owner's
    // wizard and hit "Insufficient permissions" on every step.
    return SETUP_ROLES.includes(user?.role)
      ? <Navigate to={STEP_TO_PATH[tenant.onboarding_step] || '/configure'} replace />
      : <SetupInProgress />;
  }

  const canManage = ['business_owner', 'operations_manager', 'area_manager'].includes(user?.role);
  // Business-wide KPIs are for managers; staff get Reports in that slot.
  const seesKpi = !!user && user.role !== 'employee';

  return (
    <InboxBadgeProvider>
      <AppShell
        user={user}
        tenant={tenant}
        t={t}
        canManage={canManage}
        seesKpi={seesKpi}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onLogout={handleLogout}
      />
    </InboxBadgeProvider>
  );
}

// The five tabs on a phone (the design handoff's "Today, Library, Reports,
// Inbox, Profile"). The web's Kitchen and Bar tabs are shortcuts on Today.
const TABS = [
  { to: '/app/dashboard', label: 'app.tabToday', icon: GridIcon },
  { to: '/app/library', label: 'app.tabLibrary', icon: LayersIcon },
  { to: '/app/reports', label: 'tab.reports', icon: FileTextIcon },
  { to: '/app/inbox', label: 'app.tabInbox', icon: MessageIcon, badge: 'messages' },
  { to: '/app/account', label: 'app.tabProfile', icon: UserIcon },
];
const TAB_PATHS = TABS.map((tab) => tab.to);

// Where "back" goes from a page opened by address rather than from
// inside the app (a shared link, a reload), when there's no history.
function parentOf(pathname) {
  if (pathname.startsWith('/app/library/')) return '/app/library';
  if (pathname.startsWith('/app/inbox/')) return '/app/inbox';
  if (pathname.startsWith('/app/reports/')) return '/app/reports';
  if (pathname === '/app/team' || pathname === '/app/checklists') return '/app/account';
  return '/app/dashboard';
}

function AppShell({ user, tenant, t, canManage, seesKpi, sidebarOpen, setSidebarOpen, onLogout }) {
  useLibraryNames();
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadMessages } = useInboxBadges();
  const onTab = TAB_PATHS.includes(location.pathname);
  // Pages with their own full-height layout (thread, checklist run) draw
  // their own header and action bar.
  const ownChrome = /^\/app\/inbox\/[^/]+/.test(location.pathname);

  const goBack = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(parentOf(location.pathname));
  };

  return (
    <div className={`layout${onTab ? ' on-tab' : ' on-subpage'}`}>
      {!onTab && !ownChrome && (
        <div className="back-bar">
          <button type="button" className="back-btn" onClick={goBack} aria-label={t('page.back')}>
            <ChevronStartIcon size={24} />
          </button>
        </div>
      )}

      <div className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <span className="brand"><Logo size={28} theme="reverse" /></span>
        <nav>
          <NavLink to="/app/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}><GridIcon size={18} /> {t('app.tabToday')}</NavLink>
          <NavLink to="/app/library" className={({ isActive }) => (isActive ? 'active' : '')}><LayersIcon size={18} /> {t('app.tabLibrary')}</NavLink>
          <NavLink to="/app/reports" className={({ isActive }) => (isActive ? 'active' : '')}><FileTextIcon size={18} /> {t('nav.reports')}</NavLink>
          <NavLink to="/app/inbox" className={({ isActive }) => (isActive ? 'active' : '')}>
            <MessageIcon size={18} /> <span className="nav-label">{t('app.tabInbox')}</span>
            {unreadMessages > 0 && <span className="count-badge">{unreadMessages}</span>}
          </NavLink>
          <NavLink to="/app/notifications" className={({ isActive }) => (isActive ? 'active' : '')}><BellIcon size={18} /> {t('app.notifications')}</NavLink>
          {seesKpi && <NavLink to="/app/kpi" className={({ isActive }) => (isActive ? 'active' : '')}><BarChartIcon size={18} /> {t('nav.kpi')}</NavLink>}
          <div className="sidebar-divider" />
          <NavLink to="/app/forms/kitchen" className={({ isActive }) => (isActive ? 'active' : '')}><StoveIcon size={18} /> {t('nav.kitchen')}</NavLink>
          <NavLink to="/app/forms/bar" className={({ isActive }) => (isActive ? 'active' : '')}><CoffeeIcon size={18} /> {t('nav.bar')}</NavLink>
          <NavLink to="/app/forms/opening" className={({ isActive }) => (isActive ? 'active' : '')}><DoorOpenIcon size={18} /> {t('nav.opening')}</NavLink>
          <NavLink to="/app/forms/closing" className={({ isActive }) => (isActive ? 'active' : '')}><DoorClosedIcon size={18} /> {t('nav.closing')}</NavLink>
          {/* Staff have no manager links; one divider, not two around nothing. */}
          {/* Every manager role, store managers included, runs the NFSA self-inspection. */}
          {user?.role !== 'employee' && <div className="sidebar-divider" />}
          {canManage && <NavLink to="/app/checklists" className={({ isActive }) => (isActive ? 'active' : '')}><ClipboardCheckIcon size={18} /> {t('nav.builder')}</NavLink>}
          {canManage && <NavLink to="/app/team" className={({ isActive }) => (isActive ? 'active' : '')}><StorefrontIcon size={18} /> {t('nav.team')}</NavLink>}
          {canManage && <NavLink to="/app/forms/qc-visit" className={({ isActive }) => (isActive ? 'active' : '')}><SearchIcon size={18} /> {t('nav.qcVisit')}</NavLink>}
          {canManage && <NavLink to="/app/forms/area-manager-visit" className={({ isActive }) => (isActive ? 'active' : '')}><MapPinIcon size={18} /> {t('nav.areaVisit')}</NavLink>}
          {canManage && <NavLink to="/app/forms/ops-manager-visit" className={({ isActive }) => (isActive ? 'active' : '')}><BriefcaseIcon size={18} /> {t('nav.opsVisit')}</NavLink>}
          {user?.role !== 'employee' && <NavLink to="/app/nfsa" className={({ isActive }) => (isActive ? 'active' : '')}><ShieldIcon size={18} /> {t('nfsa.menu')}</NavLink>}
          <div className="sidebar-divider" />
          <NavLink to="/app/account" className={({ isActive }) => (isActive ? 'active' : '')}><UserIcon size={18} /> {t('nav.account')}</NavLink>
          <FeedbackButton onOpen={() => setSidebarOpen(false)} />
          <a href="#" onClick={(e) => { e.preventDefault(); onLogout(); }}><LogOutIcon size={18} /> {t('nav.logout')}</a>
        </nav>
      </div>
      <div className="main">
        <div className="main-who">
          {user?.fullName} · <span className="pill pill-green">{t(`role.${user?.role}`)}</span>
        </div>
        {tenant?.plan_ended && (
          <div className="error-banner plan-ended-banner" role="status">
            {t('plan.ended')}{' '}
            {user?.role === 'business_owner'
              ? <NavLink to="/app/account" className="link-btn">{t('plan.resubscribe')}</NavLink>
              : t('plan.askOwner')}
          </div>
        )}
        <Outlet />
      </div>

      {onTab && (
        <nav className="mobile-tabbar" aria-label={t('app.tabs')}>
          {TABS.map(({ to, label, icon: Icon, badge }) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="tab-icon">
                <Icon size={22} />
                {badge === 'messages' && unreadMessages > 0 && <span className="count-badge tab-badge">{unreadMessages > 99 ? '99+' : unreadMessages}</span>}
              </span>
              {t(label)}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
