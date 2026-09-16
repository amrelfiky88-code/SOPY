import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import StepRoles from './StepRoles.jsx';
import StepStores from './StepStores.jsx';
import StepInvites from './StepInvites.jsx';
import StepAccessLevels from './StepAccessLevels.jsx';

const STEPS = ['roles', 'stores', 'invites', 'access'];

export default function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setTenant } = useAuth();

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async () => {
    setFinishing(true);
    setError('');
    try {
      const { tenant } = await api.post('/onboarding/complete', {});
      // AppLayout redirects based on tenant.onboarding_step from context,
      // so it must be updated here or it'll bounce back to this wizard.
      setTenant(tenant);
      navigate('/app/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div className="screen-narrow">
      <div className="stepper">
        {STEPS.map((s, i) => <div key={s} className={`dot ${i <= step ? 'done' : ''}`} />)}
      </div>
      {error && <div className="error-banner">{error}</div>}

      {step === 0 && <StepRoles onNext={next} />}
      {step === 1 && <StepStores onNext={next} onBack={back} />}
      {step === 2 && <StepInvites onNext={next} onBack={back} />}
      {step === 3 && <StepAccessLevels onNext={finish} onBack={back} finishing={finishing} />}
    </div>
  );
}
