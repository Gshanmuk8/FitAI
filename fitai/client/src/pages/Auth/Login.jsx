import React, { useState } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { signIn } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';

export default function Login() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  // Where to return after login: the protected page they were bounced from
  // (keeping its query/hash), else the dashboard. `notice` is set by
  // /auth/callback after email confirm.
  const fromLoc = location.state?.from;
  const from = fromLoc ? `${fromLoc.pathname}${fromLoc.search || ''}${fromLoc.hash || ''}` : '/dashboard';
  const notice = location.state?.notice;

  // Already signed in (e.g. re-visiting /login) — don't show the form.
  if (!loading && user) return <Navigate to={from} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  // The form is the DIRECT child of .page-form — that is what puts it on a
  // surface, centres it in the viewport, and collapses it to a bare form on
  // a phone. The secondary routes sit outside the card: they are ways off
  // this page, not part of the task on it.
  return (
    <div className="page page-form page-enter">
      <form onSubmit={handleSubmit}>
        <h1 className="page-title">Sign in</h1>
        {notice && <p className="notice">{notice}</p>}

        <label className="label" htmlFor="login-email">Email</label>
        <input className="field" id="login-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" autoComplete="email" required />

        <label className="label" htmlFor="login-password">Password</label>
        <input className="field" id="login-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" type="password" autoComplete="current-password" required />

        {error && <p className="error-text" style={{ margin: 'var(--s3) 0 0' }}>{error}</p>}

        {/* The one pigment moment on the screen, full width so there is no
            question about what to do next. */}
        <Button type="submit" disabled={busy} style={{ width: '100%', marginTop: 'var(--s5)' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p
        className="small"
        style={{
          display: 'flex', justifyContent: 'space-between', gap: 'var(--s3)',
          flexWrap: 'wrap', margin: 'var(--s4) 0 0',
        }}
      >
        <Link to="/signup">Need an account?</Link>
        <Link to="/forgot-password">Forgot password?</Link>
      </p>
    </div>
  );
}
