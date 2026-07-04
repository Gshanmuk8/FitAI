import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Landing point for Supabase email links (signup confirmation, magic links).
// Supabase appends the session token — or an error — to the URL; supabase-js
// (detectSessionInUrl) exchanges it during AuthProvider init. We wait for that
// to settle, then route the user instead of leaving them on a raw callback URL.
export default function AuthCallback() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Capture any link error synchronously on first render — supabase-js strips
  // the token/hash from the URL as soon as it processes it, so reading it later
  // in an effect would be too late.
  const [urlError] = useState(() => {
    const query = new URLSearchParams(window.location.search.replace(/^\?/, ''));
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const raw =
      query.get('error_description') || hash.get('error_description') ||
      query.get('error') || hash.get('error');
    return raw ? decodeURIComponent(raw.replace(/\+/g, ' ')) : null;
  });

  useEffect(() => {
    if (loading) return; // wait for supabase to finish reading the URL

    if (user) {
      // Signed in — Dashboard forwards users without a plan to onboarding.
      navigate('/dashboard', { replace: true });
      return;
    }

    // No session: link expired/already used, or it was opened on a different
    // device than sign-up (PKCE verifier missing). The email is confirmed
    // regardless, so send them to log in with an explanation.
    navigate('/login', {
      replace: true,
      state: { notice: urlError || 'Your email is confirmed. Please log in to continue.' },
    });
  }, [user, loading, urlError, navigate]);

  return <div className="page-loading">Confirming your account…</div>;
}
