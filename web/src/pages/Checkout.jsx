import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useT } from '../i18n/index.jsx';
import { money } from '../i18n/pageLabels.js';
import { CheckCircleIcon, ShieldIcon } from '../components/icons.jsx';

export default function Checkout() {
  const t = useT();
  const { user, tenant, setTenant } = useAuth();
  const navigate = useNavigate();
  const [pricing, setPricing] = useState(null);
  // Referral credit taken off this first payment.
  const [credit, setCredit] = useState({ applied: 0, dueToday: null });
  const [mock, setMock] = useState(false);
  const [alreadyActive, setAlreadyActive] = useState(false);
  const [transactionId, setTransactionId] = useState(null);
  const [error, setError] = useState('');
  // preparing → the order is being priced; ready → waiting on the customer;
  // processing → payment taken, waiting for it to be confirmed.
  const [status, setStatus] = useState('preparing');
  const paddleRef = useRef(null);
  const liveRef = useRef(true);

  useEffect(() => {
    liveRef.current = true;
    return () => { liveRef.current = false; };
  }, []);

  // Billing is owner-only on the server too (requireRole business_owner);
  // checking here as well keeps a manager who lands on this URL from
  // getting a raw "Insufficient permissions" error next to a payment form.
  const canPay = !user || user.role === 'business_owner';

  const loadOrder = useCallback(async () => {
    if (user && user.role !== 'business_owner') { setStatus('ready'); return; }
    setError('');
    setStatus('preparing');
    try {
      const data = await api.post('/billing/checkout', {});
      if (!liveRef.current) return;
      setPricing(data.pricing);
      setCredit({ applied: Number(data.creditApplied || 0), kind: data.creditKind, dueToday: data.dueToday ?? data.pricing?.monthlyTotal });
      setMock(!!data.mock);
      setAlreadyActive(!!data.alreadyActive);
      setTransactionId(data.transactionId || null);
      setStatus('ready');
    } catch (err) {
      if (!liveRef.current) return;
      setError(err.message);
      setStatus('ready');
    }
  }, [user]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  const finish = useCallback(async () => {
    const { tenant: updated } = await api.get('/tenants/current');
    if (!liveRef.current) return;
    setTenant(updated);
    // An owner who already finished setup can land here from a bookmark —
    // send them to the app rather than back through the wizard.
    navigate(updated?.onboarding_step === 'complete' ? '/app/dashboard' : '/onboarding');
  }, [navigate, setTenant]);

  // Paddle confirms payment out-of-band via webhook, so after the overlay
  // closes we poll our own record rather than trusting the browser event.
  const pollForActiveSubscription = useCallback(async () => {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      if (!liveRef.current) return;
      const { subscription } = await api.get('/billing/subscription');
      if (!liveRef.current) return;
      if (subscription?.status === 'active') return finish();
    }
    if (liveRef.current) {
      setError(t('checkout.slowConfirm'));
      setStatus('ready');
    }
  }, [finish, t]);

  const handlePay = async () => {
    setError('');
    try {
      const clientToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
      if (!clientToken) {
        setError(t('checkout.cardsUnavailable'));
        return;
      }
      const { initializePaddle } = await import('@paddle/paddle-js');
      const paddle = paddleRef.current || await initializePaddle({
        environment: import.meta.env.VITE_PADDLE_ENV || 'sandbox',
        token: clientToken,
        eventCallback: (event) => {
          if (event.name === 'checkout.completed') {
            setStatus('processing');
            pollForActiveSubscription();
          }
        },
      });
      paddleRef.current = paddle;
      paddle.Checkout.open({ transactionId });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMockComplete = async () => {
    setStatus('processing');
    setError('');
    try {
      await api.post('/billing/mock-complete', {});
      await finish();
    } catch (err) {
      setError(err.message);
      setStatus('ready');
    }
  };

  if (!canPay) {
    return (
      <div className="screen-narrow">
        <CheckoutStepper />
        <h2>{t('checkout.title')}</h2>
        <div className="card">
          <p style={{ margin: 0 }}>{t('checkout.ownerOnly', { restaurant: tenant?.restaurant_name || t('checkout.thisAccount') })}</p>
        </div>
      </div>
    );
  }

  if (status === 'preparing') {
    return (
      <div className="screen-narrow">
        <CheckoutStepper />
        <h2>{t('checkout.title')}</h2>
        <p>{t('checkout.preparing')}</p>
      </div>
    );
  }

  // A business that already finished setup comes here from Profile &
  // billing, not the signup funnel — no signup stepper, and "back to the
  // app" rather than "continue to setup".
  const setUp = tenant?.onboarding_step === 'complete';

  if (alreadyActive) {
    return (
      <div className="screen-narrow">
        {!setUp && <CheckoutStepper />}
        <h2>{t('checkout.title')}</h2>
        <div className="card empty-state">
          <CheckCircleIcon size={32} style={{ color: 'var(--green)', opacity: 1 }} />
          <p style={{ margin: 0 }}>{t('checkout.alreadyActive', { restaurant: tenant?.restaurant_name || '', amount: money(pricing?.monthlyTotal) })}</p>
        </div>
        <button className="btn btn-primary" onClick={finish}>{setUp ? t('checkout.backToApp') : t('checkout.continueSetup')}</button>
      </div>
    );
  }

  const creditLabel = credit.kind === 'welcome' ? t('checkout.welcomeDiscount')
    : credit.kind === 'referral' ? t('checkout.referralCredit') : t('checkout.accountCredit');

  return (
    <div className="screen-narrow">
      {!setUp && <CheckoutStepper />}
      {setUp && <Link to="/app/account" className="auth-brand" style={{ fontSize: 15, marginBottom: 12 }}>{t('checkout.backToAccount')}</Link>}
      <h2>{t('checkout.title')}</h2>
      <p>{t('checkout.intro', { restaurant: tenant?.restaurant_name || t('checkout.yourAccount') })}</p>

      {error && (
        <div className="error-banner">
          {error}{' '}
          <button type="button" className="link-btn" onClick={loadOrder}>{t('common.tryAgain')}</button>
        </div>
      )}

      {/* When the order never priced, "Try again" alone is a dead end —
          most of these failures are fixed by editing the plan. */}
      {error && !pricing && (
        <div className="card">
          <p style={{ margin: 0 }}>{t('checkout.adjustPlan')}</p>
          <Link to="/pricing" className="btn btn-secondary" style={{ marginTop: 12 }}>{t('checkout.changePlan')}</Link>
        </div>
      )}

      {pricing && (
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>{t('checkout.summary')}</h3>

          <div className="summary-row">
            <span>
              {t('page.branchesLabel')}
              <span className="hint"> {t('page.avgRate', { n: pricing.branchCount, rate: money(pricing.branchBlendedRate) })}</span>
            </span>
            <span>{money(pricing.branchSubtotal)}</span>
          </div>
          <div className="summary-row">
            <span>
              {t('page.usersLabel')}
              <span className="hint"> {t('page.avgRate', { n: pricing.userCount, rate: money(pricing.userBlendedRate) })}</span>
            </span>
            <span>{money(pricing.userSubtotal)}</span>
          </div>

          <div className="summary-row summary-total">
            <span>{t('checkout.billedMonthly')}</span>
            <span>{money(pricing.monthlyTotal)}</span>
          </div>

          {credit.applied > 0 && (
            <>
              <div className="summary-row">
                <span>{creditLabel}</span>
                <span className="referral-plus">−{money(credit.applied)}</span>
              </div>
              <div className="summary-row summary-total">
                <span>{t('checkout.dueToday')}</span>
                <span>{money(credit.dueToday)}</span>
              </div>
              <p className="hint" style={{ marginTop: 6, marginBottom: 0 }}>
                {t(credit.kind === 'welcome' ? 'checkout.welcomeNote' : 'checkout.creditNote', { amount: money(pricing.monthlyTotal) })}
              </p>
            </>
          )}

          <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
            {t('checkout.terms', { currency: pricing.currency || 'USD' })}
          </p>
          <Link to="/pricing" className="link-btn" style={{ display: 'inline-block', marginTop: 10 }}>
            {t('checkout.changePlan')}
          </Link>
        </div>
      )}

      {/* No priced order means the request failed — showing a payment
          button next to the error would just offer to charge $0.00. */}
      {!pricing ? null : status === 'processing' ? (
        <div className="card">
          <p style={{ margin: 0 }}>{t('checkout.confirming')}</p>
          <p className="hint" style={{ marginBottom: 0 }}>{t('checkout.confirmingHint')}</p>
        </div>
      ) : mock ? (
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>{t('checkout.payment')}</h3>
          <p className="hint" style={{ marginTop: 0 }}>{t('checkout.demoNote')}</p>
          <button className="btn btn-primary" onClick={handleMockComplete}>
            {t('checkout.activateDemo')}
          </button>
        </div>
      ) : (
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>{t('checkout.payment')}</h3>
          <button className="btn btn-primary" onClick={handlePay} disabled={!transactionId}>
            {t('checkout.pay', { amount: money(credit.applied > 0 ? credit.dueToday : pricing?.monthlyTotal) })}
          </button>
          <p className="hint secure-note">
            <ShieldIcon size={14} /> {t('checkout.secure')}
          </p>
        </div>
      )}
    </div>
  );
}

function CheckoutStepper() {
  return (
    <div className="stepper">
      <div className="dot done" /><div className="dot done" /><div className="dot done" /><div className="dot done" /><div className="dot" />
    </div>
  );
}
