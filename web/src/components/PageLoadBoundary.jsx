import React, { Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { useT } from '../i18n/index.jsx';

// The less-used screens are downloaded when first opened (App.jsx). If that
// fails (no signal, or an update replaced the file since the app was opened),
// say so with a Reload button instead of leaving a blank page. Keyed by the
// address, so going to another screen clears it.
class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err) {
    console.error('Screen failed to load:', err);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="error-banner" role="alert" style={{ margin: 16 }}>
        {this.props.message}{' '}
        <button type="button" className="link-btn" onClick={() => window.location.reload()}>{this.props.reloadLabel}</button>
      </div>
    );
  }
}

export default function PageLoadBoundary({ children }) {
  const t = useT();
  const { pathname } = useLocation();
  return (
    <Boundary key={pathname} message={t('app.pageLoadFailed')} reloadLabel={t('app.reload')}>
      <Suspense fallback={<p className="hint" style={{ padding: 16 }}>{t('common.loading')}</p>}>
        {children}
      </Suspense>
    </Boundary>
  );
}
