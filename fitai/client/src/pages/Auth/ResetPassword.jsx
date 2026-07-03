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

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) {
    return (
      <div className="page-enter" style={{ maxWidth: 360, margin: '6rem auto' }}>
        <h2 className="font-display">Link expired</h2>
        <p>This reset link is invalid or has expired. Request a new one from the login page.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="page-enter" style={{ maxWidth: 360, margin: '6rem auto' }}>
      <h2 className="font-display">Choose a new password</h2>
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" type="password" minLength={8} required style={{ width: '100%', marginBottom: '0.75rem' }} />
      {error && <p className="error-text">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Set new password'}</Button>
    </form>
  );
}
