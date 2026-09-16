import React, { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  GridIcon,
  BarChartIcon,
  StoveIcon,
  CoffeeIcon,
  ClipboardCheckIcon,
  StorefrontIcon,
  LogOutIcon,
} from './icons.jsx';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close the drawer automatically whenever the route changes, so
  // tapping a nav link on mobile doesn't leave it open over the new page.
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (tenant && tenant.onboarding_step !== 'complete') {
    return <Navigate to={STEP_TO_PATH[tenant.onboarding_step] || '/configure'} replace />;
  }

  const canManage = ['business_owner', 'operations_manager', 'area_manager'].includes(user?.role);

  return (
    <div className="layout">
      <div className="mobile-topbar">
        <button
          type="button"
          className="hamburger-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          ☰
        </button>
        <span className="brand">SOPY</span>
      </div>

      <div className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <span className="brand">SOPY</span>
        <nav>
          <NavLink to="/app/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}><GridIcon size={18} /> Dashboard</NavLink>
          <NavLink to="/app/kpi" className={({ isActive }) => (isActive ? 'active' : '')}><BarChartIcon size={18} /> KPI dashboard</NavLink>
          <NavLink to="/app/forms/kitchen" className={({ isActive }) => (isActive ? 'active' : '')}><StoveIcon size={18} /> Kitchen daily report</NavLink>
          <NavLink to="/app/forms/bar" className={({ isActive }) => (isActive ? 'active' : '')}><CoffeeIcon size={18} /> Bar &amp; beverage report</NavLink>
          {canManage && <NavLink to="/app/checklists" className={({ isActive }) => (isActive ? 'active' : '')}><ClipboardCheckIcon size={18} /> Checklist builder</NavLink>}
          {canManage && <NavLink to="/app/team" className={({ isActive }) => (isActive ? 'active' : '')}><StorefrontIcon size={18} /> Team &amp; stores</NavLink>}
          <div className="sidebar-divider" />
          <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}><LogOutIcon size={18} /> Log out</a>
        </nav>
      </div>
      <div className="main">
        <div style={{ marginBottom: 20, color: 'var(--ink-soft)', fontSize: 14 }}>
          {user?.fullName} · <span className="pill pill-green">{roleLabel(user?.role)}</span>
        </div>
        <Outlet />
      </div>
    </div>
  );
}

function roleLabel(role) {
  return {
    business_owner: 'Business Owner',
    operations_manager: 'Operations Manager',
    area_manager: 'Area Manager',
    store_manager: 'Store Manager',
    employee: 'Employee',
  }[role] || role;
}
