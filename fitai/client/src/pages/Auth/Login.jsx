import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signIn } from '../../services/authService';
import Button from '../../components/ui/Button';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="page-enter" style={{ maxWidth: 360, margin: '6rem auto' }}>
      <h2 className="font-display">Log in</h2>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required style={{ width: '100%', marginBottom: '0.75rem' }} />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required style={{ width: '100%', marginBottom: '0.75rem' }} />
      {error && <p className="error-text">{error}</p>}
      <Button type="submit">Log in</Button>
      <p style={{ marginTop: '1rem' }}>
        <Link to="/signup">Need an account?</Link> · <Link to="/forgot-password">Forgot password?</Link>
      </p>
    </form>
  );
}
