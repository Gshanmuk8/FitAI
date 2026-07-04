import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { isOnboarded } from '../../services/onboardingService';

// Landing point for Supabase email links (signup confirmation, magic links).
// supabase-js runs the implicit flow (v2 default): the confirmation link comes
// back with the session token in the URL, and detectSessionInUrl exchanges it
// during AuthProvider init. AuthContext.loading stays true until that init
// resolves — so we wait for it before deciding anything (no redirect races).
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
    if (loading) return; // wait for supabase to finish establishing the session

    // No session: link expired/already used, or opened on a device that never
    // held the session. The email is confirmed regardless — send them to log in.
    if (!user) {
      navigate('/login', {
        replace: true,
        state: { notice: urlError || 'Your email is confirmed. Please log in to continue.' },
      });
      return;
    }

    // Authenticated. Route by onboarding status, per the intended flow:
    //   incomplete -> /onboarding, complete -> /dashboard. Never the landing page.
    // If the status check itself fails (backend down/cold), fall back to
    // /dashboard, which has its own onboarding gate and a retryable error state.
    let cancelled = false;
    isOnboarded()
      .then((done) => { if (!cancelled) navigate(done ? '/dashboard' : '/onboarding', { replace: true }); })
      .catch(() => { if (!cancelled) navigate('/dashboard', { replace: true }); });
    return () => { cancelled = true; };
  }, [user, loading, urlError, navigate]);

  return <div className="page-loading">Confirming your account…</div>;
}
