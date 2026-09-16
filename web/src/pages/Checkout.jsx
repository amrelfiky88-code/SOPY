import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Checkout() {
  const { tenant, setTenant } = useAuth();
  const navigate = useNavigate();
  const [pricing, setPricing] = useState(null);
  const [mock, setMock] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('preparing'); // preparing | ready | processing
  const paddleRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.post('/billing/checkout', {});
        if (cancelled) return;
        setPricing(data.pricing);
        setMock(data.mock);

        if (!data.mock) {
          const clientToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
          if (!clientToken) {
            setError('Paddle is configured on the server but VITE_PADDLE_CLIENT_TOKEN is missing on the frontend.');
            return;
          }
          const { initializePaddle } = await import('@paddle/paddle-js');
          const paddle = await initializePaddle({
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
          paddle.Checkout.open({ transactionId: data.transactionId });
        }
        setStatus('ready');
      } catch (err) {
        setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const pollForActiveSubscription = async () => {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const { subscription } = await api.get('/billing/subscription');
      if (subscription?.status === 'active') {
        const { tenant: updated } = await api.get('/tenants/current');
        setTenant(updated);
        navigate('/onboarding');
        return;
      }
    }
    setError('Payment is taking longer than expected to confirm. Refresh in a moment.');
  };

  const handleMockComplete = async () => {
    setStatus('processing');
    setError('');
    try {
      await api.post('/billing/mock-complete', {});
      const { tenant: updated } = await api.get('/tenants/current');
      setTenant(updated);
      navigate('/onboarding');
    } catch (err) {
      setError(err.message);
      setStatus('ready');
    }
  };

  return (
    <div className="screen-narrow">
      <div className="stepper">
        <div className="dot done" /><div className="dot done" /><div className="dot done" /><div className="dot done" /><div className="dot" />
      </div>
      <h2>Checkout</h2>
      {error && <div className="error-banner">{error}</div>}

      {pricing && (
        <div className="card">
          <p style={{ margin: 0 }}>{tenant?.restaurant_name}</p>
          <p style={{ margin: 0 }}>{pricing.branchCount} branches, {pricing.userCount} users</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            <strong>Billed monthly</strong>
            <strong style={{ fontSize: 22 }}>${pricing.monthlyTotal.toFixed(2)}</strong>
          </div>
        </div>
      )}

      {mock && (
        <>
          <p className="hint">
            Paddle keys aren't configured on this server yet, so checkout is running in demo mode.
            Add PADDLE_API_KEY / PADDLE_WEBHOOK_SECRET to server/.env to take real payments.
          </p>
          <button className="btn btn-primary" onClick={handleMockComplete} disabled={status === 'processing'}>
            {status === 'processing' ? 'Activating…' : 'Simulate successful payment'}
          </button>
        </>
      )}

      {!mock && status === 'processing' && <p>Confirming your payment with Paddle…</p>}
    </div>
  );
}
