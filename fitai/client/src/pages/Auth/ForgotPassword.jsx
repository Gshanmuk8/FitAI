import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../../services/authService';
import Button from '../../components/ui/Button';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="page page-form page-enter">
        <div className="auth-card">
          <h1 className="page-title">Check your email</h1>
          <p className="muted" style={{ margin: 0 }}>
            If an account exists for <strong style={{ color: 'var(--text)' }}>{email}</strong>, a password-reset link is on its way.
          </p>
        </div>
        <p className="small" style={{ margin: 'var(--s4) 0 0', textAlign: 'center' }}>
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="page page-form page-enter">
      <form onSubmit={handleSubmit}>
        <h1 className="page-title">Reset password</h1>

        <label className="label" htmlFor="forgot-email">Email</label>
        <input className="field" id="forgot-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" autoComplete="email" required />

        {error && <p className="error-text" style={{ margin: 'var(--s3) 0 0' }}>{error}</p>}

        <Button type="submit" disabled={busy} style={{ width: '100%', marginTop: 'var(--s5)' }}>
          {busy ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <p className="small" style={{ margin: 'var(--s4) 0 0', textAlign: 'center' }}>
        <Link to="/login">Back to sign in</Link>
      </p>
    </div>
  );
}
