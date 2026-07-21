import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { updatePassword } from '../../services/authService';
import Button from '../../components/ui/Button';

// Users land here from the email link — Supabase establishes a recovery
// session on arrival, so useAuth().user is set. Direct visits without a
// recovery session get pointed back to the request form.
export default function ResetPassword() {
  const { user, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await updatePassword(password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="page-loading">Checking your reset link…</div>;
  if (!user) {
    return (
      <div className="page page-form page-enter">
        <div className="auth-card">
          <h1 className="page-title">Link expired</h1>
          <p className="muted" style={{ margin: 0 }}>
            This reset link is invalid or has expired. Request a new one from the sign-in page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-form page-enter">
      <form onSubmit={handleSubmit}>
        <h1 className="page-title">Choose a new password</h1>

        <label className="label" htmlFor="reset-password">New password</label>
        <input className="field" id="reset-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" type="password" autoComplete="new-password" minLength={8} required />

        {error && <p className="error-text" style={{ margin: 'var(--s3) 0 0' }}>{error}</p>}

        <Button type="submit" disabled={busy} style={{ width: '100%', marginTop: 'var(--s5)' }}>
          {busy ? 'Saving…' : 'Set new password'}
        </Button>
      </form>
    </div>
  );
}
