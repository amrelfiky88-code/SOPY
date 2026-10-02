import React, { useState } from 'react';
import { useT } from '../i18n/index.jsx';
import { EyeIcon, EyeOffIcon } from './icons.jsx';

// A password box with an eye button to show what's been typed: on a phone
// keyboard a typo in a hidden password is easy to make and hard to spot.
// Takes the usual <input> props (id, value, onChange, autoComplete…).
export default function PasswordInput(props) {
  const t = useT();
  const [shown, setShown] = useState(false);
  return (
    <div className="password-input">
      <input {...props} type={shown ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? t('field.hidePassword') : t('field.showPassword')}
        aria-pressed={shown}
        aria-controls={props.id}
      >
        {shown ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
      </button>
    </div>
  );
}
