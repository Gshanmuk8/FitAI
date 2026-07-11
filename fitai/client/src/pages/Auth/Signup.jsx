import React, { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { signUp } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';

export default function Signup() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // Already signed in — no reason to show the signup form. Gated on !busy:
  // with auto-confirm enabled, signUp() flips the auth state mid-submit and
  // this Navigate would race the handler's navigate('/onboarding'), able to
  // dump a brand-new user on the empty dashboard instead of onboarding.
  if (!loading && user && !busy) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await signUp(email, password);
      // With email confirmation enabled (Supabase default) there is no
      // session yet — sending the user to a protected route would just
      // bounce them. Tell them what to do instead.
      if (data.session) {
        navigate('/onboarding', { replace: true });
      } else {
        setNeedsConfirmation(true);
        setBusy(false);
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (needsConfirmation) {
    return (
      <div className="page page-form page-enter">
        <h2 className="page-title">Confirm your email</h2>
        <p>
          We sent a confirmation link to <strong>{email}</strong>. Click it, then{' '}
          <Link to="/login">sign in</Link> to start onboarding.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="page page-form page-enter">
      <h2 className="page-title">Sign up</h2>
      <label className="label" htmlFor="signup-email">Email</label>
      <input id="signup-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" autoComplete="email" required style={{ width: '100%' }} />
      <label className="label" htmlFor="signup-password">Password</label>
      <input id="signup-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" type="password" autoComplete="new-password" minLength={8} required style={{ width: '100%' }} />
      {error && <p className="error-text">{error}</p>}
      <Button type="submit" disabled={busy} style={{ marginTop: '1.25rem' }}>{busy ? 'Creating account…' : 'Sign up'}</Button>
      <p style={{ marginTop: '1rem' }}><Link to="/login">Already have an account?</Link></p>
    </form>
  );
}
