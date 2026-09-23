import React, { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useT } from '../i18n/index.jsx';
import FeedbackButton from './FeedbackButton.jsx';
import SetupInProgress from '../pages/onboarding/SetupInProgress.jsx';
import {
  MenuIcon,
  FileTextIcon,
  GridIcon,
  BarChartIcon,
  StoveIcon,
  CoffeeIcon,
  ClipboardCheckIcon,
  StorefrontIcon,
  LogOutIcon,
  DoorOpenIcon,
  DoorClosedIcon,
  SearchIcon,
  MapPinIcon,
  BriefcaseIcon,
  UserIcon,
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

  return (
    <div className="layout">
      <div className="mobile-topbar">
        <button
          type="button"
          className="hamburger-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label={t('nav.openMenu')}
          aria-expanded={sidebarOpen}
        >
          <MenuIcon size={22} strokeWidth="2" />
        </button>
        <span className="brand">SOPY</span>
      </div>

      <div className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <span className="brand">SOPY</span>
        <nav>
          <NavLink to="/app/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}><GridIcon size={18} /> {t('nav.dashboard')}</NavLink>
          <NavLink to="/app/kpi" className={({ isActive }) => (isActive ? 'active' : '')}><BarChartIcon size={18} /> {t('nav.kpi')}</NavLink>
          <NavLink to="/app/forms/kitchen" className={({ isActive }) => (isActive ? 'active' : '')}><StoveIcon size={18} /> {t('nav.kitchen')}</NavLink>
          <NavLink to="/app/forms/bar" className={({ isActive }) => (isActive ? 'active' : '')}><CoffeeIcon size={18} /> {t('nav.bar')}</NavLink>
          <NavLink to="/app/forms/opening" className={({ isActive }) => (isActive ? 'active' : '')}><DoorOpenIcon size={18} /> {t('nav.opening')}</NavLink>
          <NavLink to="/app/forms/closing" className={({ isActive }) => (isActive ? 'active' : '')}><DoorClosedIcon size={18} /> {t('nav.closing')}</NavLink>
          <NavLink to="/app/reports" className={({ isActive }) => (isActive ? 'active' : '')}><FileTextIcon size={18} /> {t('nav.reports')}</NavLink>
          <div className="sidebar-divider" />
          {canManage && <NavLink to="/app/checklists" className={({ isActive }) => (isActive ? 'active' : '')}><ClipboardCheckIcon size={18} /> {t('nav.builder')}</NavLink>}
          {canManage && <NavLink to="/app/team" className={({ isActive }) => (isActive ? 'active' : '')}><StorefrontIcon size={18} /> {t('nav.team')}</NavLink>}
          {canManage && <NavLink to="/app/forms/qc-visit" className={({ isActive }) => (isActive ? 'active' : '')}><SearchIcon size={18} /> {t('nav.qcVisit')}</NavLink>}
          {canManage && <NavLink to="/app/forms/area-manager-visit" className={({ isActive }) => (isActive ? 'active' : '')}><MapPinIcon size={18} /> {t('nav.areaVisit')}</NavLink>}
          {canManage && <NavLink to="/app/forms/ops-manager-visit" className={({ isActive }) => (isActive ? 'active' : '')}><BriefcaseIcon size={18} /> {t('nav.opsVisit')}</NavLink>}
          <div className="sidebar-divider" />
          <NavLink to="/app/account" className={({ isActive }) => (isActive ? 'active' : '')}><UserIcon size={18} /> {t('nav.account')}</NavLink>
          <FeedbackButton onOpen={() => setSidebarOpen(false)} />
          <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}><LogOutIcon size={18} /> {t('nav.logout')}</a>
        </nav>
      </div>
      <div className="main">
        <div style={{ marginBottom: 20, color: 'var(--ink-soft)', fontSize: 14 }}>
          {user?.fullName} · <span className="pill pill-green">{t(`role.${user?.role}`)}</span>
        </div>
        {tenant?.plan_ended && (
          <div className="error-banner" role="status">
            {t('plan.ended')}{' '}
            {user?.role === 'business_owner'
              ? <NavLink to="/app/account" className="link-btn">{t('plan.resubscribe')}</NavLink>
              : t('plan.askOwner')}
          </div>
        )}
        <Outlet />
      </div>

      <nav className="mobile-tabbar">
        <NavLink to="/app/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
          <GridIcon size={20} />
          {t('tab.home')}
        </NavLink>
        <NavLink to="/app/forms/kitchen" className={({ isActive }) => (isActive ? 'active' : '')}>
          <StoveIcon size={20} />
          {t('tab.kitchen')}
        </NavLink>
        <NavLink to="/app/forms/bar" className={({ isActive }) => (isActive ? 'active' : '')}>
          <CoffeeIcon size={20} />
          {t('tab.bar')}
        </NavLink>
        <NavLink to="/app/kpi" className={({ isActive }) => (isActive ? 'active' : '')}>
          <BarChartIcon size={20} />
          {t('tab.kpi')}
        </NavLink>
      </nav>
    </div>
  );
}

