import React from 'react';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

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
      <div className="sidebar">
        <span className="brand">SOPY</span>
        <NavLink to="/app/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>Dashboard</NavLink>
        <NavLink to="/app/kpi" className={({ isActive }) => (isActive ? 'active' : '')}>KPI dashboard</NavLink>
        <NavLink to="/app/forms/kitchen" className={({ isActive }) => (isActive ? 'active' : '')}>Kitchen daily report</NavLink>
        <NavLink to="/app/forms/bar" className={({ isActive }) => (isActive ? 'active' : '')}>Bar &amp; beverage report</NavLink>
        {canManage && <NavLink to="/app/checklists" className={({ isActive }) => (isActive ? 'active' : '')}>Checklist builder</NavLink>}
        {canManage && <NavLink to="/app/team" className={({ isActive }) => (isActive ? 'active' : '')}>Team &amp; stores</NavLink>}
        <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }} style={{ marginTop: 16 }}>Log out</a>
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
