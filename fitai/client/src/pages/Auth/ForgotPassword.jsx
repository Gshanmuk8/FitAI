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
        <h2 className="page-title">Check your email</h2>
        <p>If an account exists for <strong>{email}</strong>, a password-reset link is on its way.</p>
        <p><Link to="/login">Back to sign in</Link></p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="page page-form page-enter">
      <h2 className="page-title">Reset password</h2>
      <label className="label" htmlFor="forgot-email">Email</label>
      <input id="forgot-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" autoComplete="email" required style={{ width: '100%' }} />
      {error && <p className="error-text">{error}</p>}
      <Button type="submit" disabled={busy} style={{ marginTop: '1.25rem' }}>{busy ? 'Sending…' : 'Send reset link'}</Button>
      <p style={{ marginTop: '1rem' }}><Link to="/login">Back to sign in</Link></p>
    </form>
  );
}
