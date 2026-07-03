import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../../services/authService';
import Button from '../../components/ui/Button';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
  }

  if (sent) {
    return (
      <div className="page-enter" style={{ maxWidth: 360, margin: '6rem auto' }}>
        <h2 className="font-display">Check your email</h2>
        <p>If an account exists for <strong>{email}</strong>, a password-reset link is on its way.</p>
        <p><Link to="/login">Back to log in</Link></p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="page-enter" style={{ maxWidth: 360, margin: '6rem auto' }}>
      <h2 className="font-display">Reset password</h2>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required style={{ width: '100%', marginBottom: '0.75rem' }} />
      {error && <p className="error-text">{error}</p>}
      <Button type="submit">Send reset link</Button>
      <p style={{ marginTop: '1rem' }}><Link to="/login">Back to log in</Link></p>
    </form>
  );
}
