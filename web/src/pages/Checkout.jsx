import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { CheckCircleIcon, ShieldIcon } from '../components/icons.jsx';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function Checkout() {
  const { user, tenant, setTenant } = useAuth();
  const navigate = useNavigate();
  const [pricing, setPricing] = useState(null);
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
      setError('Your payment went through but is taking longer than usual to confirm. Refresh this page in a moment.');
      setStatus('ready');
    }
  }, [finish]);

  const handlePay = async () => {
    setError('');
    try {
      const clientToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
      if (!clientToken) {
        setError('Card payments are not available right now. Please contact support.');
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
        <h2>Checkout</h2>
        <div className="card">
          <p style={{ margin: 0 }}>
            Only the business owner can set up billing for {tenant?.restaurant_name || 'this account'}. Ask them to
            finish checkout — once the subscription is active you'll be able to sign in and get to work.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'preparing') {
    return (
      <div className="screen-narrow">
        <CheckoutStepper />
        <h2>Checkout</h2>
        <p>Preparing your order…</p>
      </div>
    );
  }

  if (alreadyActive) {
    return (
      <div className="screen-narrow">
        <CheckoutStepper />
        <h2>Checkout</h2>
        <div className="card empty-state">
          <CheckCircleIcon size={32} style={{ color: 'var(--green)', opacity: 1 }} />
          <p style={{ margin: 0 }}>
            {tenant?.restaurant_name} already has an active subscription at {money(pricing?.monthlyTotal)} a month.
            You won't be charged again here.
          </p>
        </div>
        <button className="btn btn-primary" onClick={finish}>Continue to setup</button>
      </div>
    );
  }

  return (
    <div className="screen-narrow">
      <CheckoutStepper />
      <h2>Checkout</h2>
      <p>Review your plan, then pay to activate {tenant?.restaurant_name || 'your account'}.</p>

      {error && (
        <div className="error-banner">
          {error}{' '}
          <button type="button" className="link-btn" onClick={loadOrder}>Try again</button>
        </div>
      )}

      {/* When the order never priced, "Try again" alone is a dead end —
          most of these failures are fixed by editing the plan. */}
      {error && !pricing && (
        <div className="card">
          <p style={{ margin: 0 }}>Adjust your branch and user counts, then come back to checkout.</p>
          <Link to="/pricing" className="btn btn-secondary" style={{ marginTop: 12 }}>Change plan</Link>
        </div>
      )}

      {pricing && (
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Order summary</h3>

          <div className="summary-row">
            <span>
              Branches
              <span className="hint"> {pricing.branchCount} × {money(pricing.branchBlendedRate)} avg</span>
            </span>
            <span>{money(pricing.branchSubtotal)}</span>
          </div>
          <div className="summary-row">
            <span>
              Users
              <span className="hint"> {pricing.userCount} × {money(pricing.userBlendedRate)} avg</span>
            </span>
            <span>{money(pricing.userSubtotal)}</span>
          </div>

          <div className="summary-row summary-total">
            <span>Billed monthly</span>
            <span>{money(pricing.monthlyTotal)}</span>
          </div>

          <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
            {pricing.currency || 'USD'} · Renews monthly · Cancel anytime. Change your branch or user count later and
            we'll prorate the difference on your next invoice.
          </p>
          <Link to="/pricing" className="link-btn" style={{ display: 'inline-block', marginTop: 10 }}>
            Change plan
          </Link>
        </div>
      )}

      {/* No priced order means the request failed — showing a payment
          button next to the error would just offer to charge $0.00. */}
      {!pricing ? null : status === 'processing' ? (
        <div className="card">
          <p style={{ margin: 0 }}>Confirming your payment…</p>
          <p className="hint" style={{ marginBottom: 0 }}>This usually takes a few seconds. Don't close this page.</p>
        </div>
      ) : mock ? (
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>Payment</h3>
          <p className="hint" style={{ marginTop: 0 }}>
            Card payments aren't switched on for this account yet, so you can activate in demo mode and add billing
            details later.
          </p>
          <button className="btn btn-primary" onClick={handleMockComplete}>
            Activate in demo mode
          </button>
        </div>
      ) : (
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>Payment</h3>
          <button className="btn btn-primary" onClick={handlePay} disabled={!transactionId}>
            Pay {money(pricing?.monthlyTotal)} and activate
          </button>
          <p className="hint secure-note">
            <ShieldIcon size={14} /> Card details are entered on Paddle's secure checkout — SOPY never sees them.
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
