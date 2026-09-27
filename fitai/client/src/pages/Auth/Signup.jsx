import React, { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { signUp, resendConfirmation } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';

export default function Signup() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
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

  async function handleResend() {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await resendConfirmation(email); setResent(true); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  // .auth-card is the non-form sibling of the form treatment: same surface,
  // same hairline, same collapse on a phone. A confirmation message is a
  // destination too, and it should not read as a stripped-down error page.
  if (needsConfirmation) {
    return (
      <div className="page page-form page-enter">
        <div className="auth-card">
          <h1 className="page-title">Confirm your email</h1>
          <p className="muted" style={{ margin: 0 }}>
            Check the inbox and spam folder for <strong style={{ color: 'var(--text)' }}>{email.trim()}</strong> for a confirmation link.
            If you already signed up, <Link to="/login">sign in to your existing account</Link> or <Link to="/forgot-password">reset your password</Link>.
          </p>
          {error && <p role="alert" className="error-text">{error}</p>}
          {resent && <p role="status" className="notice">If this address needs confirmation, a new link is on its way.</p>}
          <Button type="button" onClick={handleResend} disabled={busy || resent} style={{ marginTop: 'var(--s4)' }}>
            {busy ? 'Sending…' : 'Resend confirmation email'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-form page-enter">
      <form onSubmit={handleSubmit}>
        <h1 className="page-title">Sign up</h1>

        <label className="label" htmlFor="signup-email">Email</label>
        <input className="field" id="signup-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" autoComplete="email" required />

        <label className="label" htmlFor="signup-password">Password</label>
        <input className="field" id="signup-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" type="password" autoComplete="new-password" minLength={8} required />

        {error && <p role="alert" className="error-text" style={{ margin: 'var(--s3) 0 0' }}>{error}</p>}

        <Button type="submit" disabled={busy} style={{ width: '100%', marginTop: 'var(--s5)' }}>
          {busy ? 'Creating account…' : 'Sign up'}
        </Button>
      </form>

      <p className="small" style={{ margin: 'var(--s4) 0 0', textAlign: 'center' }}>
        <Link to="/login">Already have an account?</Link>
      </p>
    </div>
  );
}
