import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const AuthContext = createContext(null);

// Every fitai.* key except the device-level theme preference is per-user
// data. Wiping them on sign-out is the hard guarantee that nothing cached
// for one account can ever render for the next account in the same tab.
function clearUserStorage() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const doomed = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key && key.startsWith('fitai.') && key !== 'fitai.theme') doomed.push(key);
      }
      doomed.forEach((key) => storage.removeItem(key));
    } catch { /* storage unavailable — nothing cached, nothing to clear */ }
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Fires for expiry and cross-tab sign-outs too, not just our button —
      // so this is the one reliable place to purge the old account's cache.
      if (event === 'SIGNED_OUT') clearUserStorage();
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    clearUserStorage();
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
