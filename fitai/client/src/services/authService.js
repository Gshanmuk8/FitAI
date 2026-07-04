import { supabase } from '../utils/supabaseClient';

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Where the confirmation email's link lands. /auth/callback waits for the
    // session to be established, then forwards the user into the app. Must be
    // in the Redirect URLs allow-list in Supabase Auth settings.
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Sends Supabase's password-recovery email; the link lands the user on
// /reset-password with a recovery session already established.
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
