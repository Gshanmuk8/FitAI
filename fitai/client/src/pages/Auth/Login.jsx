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

  return (
    <form onSubmit={handleSubmit} className="page page-form page-enter">
      <h2 className="page-title">Sign in</h2>
      {notice && <p className="notice">{notice}</p>}
      <label className="label" htmlFor="login-email">Email</label>
      <input id="login-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" autoComplete="email" required style={{ width: '100%' }} />
      <label className="label" htmlFor="login-password">Password</label>
      <input id="login-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" type="password" autoComplete="current-password" required style={{ width: '100%' }} />
      {error && <p className="error-text">{error}</p>}
      <Button type="submit" disabled={busy} style={{ marginTop: '1.25rem' }}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      <p style={{ marginTop: '1rem' }}>
        <Link to="/signup">Need an account?</Link> · <Link to="/forgot-password">Forgot password?</Link>
      </p>
    </form>
  );
}
