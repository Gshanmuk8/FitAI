import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';

export default function Settings() {
  const { user, signOut } = useAuth();

  return (
    <div className="page page-narrow page-enter">
      <h2 className="page-title">Settings</h2>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Account</h3>
        <p className="muted small">{user?.email}</p>
        <Button variant="ghost" onClick={signOut}>Sign out</Button>
      </section>
    </div>
  );
}
