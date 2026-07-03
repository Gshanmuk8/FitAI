import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUp } from '../../services/authService';
import Button from '../../components/ui/Button';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await signUp(email, password);
      // With email confirmation enabled (Supabase default) there is no
      // session yet — sending the user to a protected route would just
      // bounce them. Tell them what to do instead.
      if (data.session) {
        navigate('/onboarding');
      } else {
        setNeedsConfirmation(true);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  if (needsConfirmation) {
    return (
      <div className="page-enter" style={{ maxWidth: 400, margin: '6rem auto' }}>
        <h2 className="font-display">Confirm your email</h2>
        <p>
          We sent a confirmation link to <strong>{email}</strong>. Click it, then{' '}
          <Link to="/login">log in</Link> to start onboarding.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="page-enter" style={{ maxWidth: 360, margin: '6rem auto' }}>
      <h2 className="font-display">Sign up</h2>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required style={{ width: '100%', marginBottom: '0.75rem' }} />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 8 characters)" type="password" minLength={8} required style={{ width: '100%', marginBottom: '0.75rem' }} />
      {error && <p className="error-text">{error}</p>}
      <Button type="submit">Sign up</Button>
      <p style={{ marginTop: '1rem' }}><Link to="/login">Already have an account?</Link></p>
    </form>
  );
}
