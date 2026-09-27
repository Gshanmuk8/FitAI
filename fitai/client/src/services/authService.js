import { supabase } from '../utils/supabaseClient';
import { authResult } from '../utils/authErrors';

export async function signUp(email, password) {
  return authResult(() => supabase.auth.signUp({
    email: email.trim(),
    password,
    // Where the confirmation email's link lands. /auth/callback waits for the
    // session to be established, then forwards the user into the app. Must be
    // in the Redirect URLs allow-list in Supabase Auth settings.
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  }));
}

export async function signIn(email, password) {
  return authResult(() => supabase.auth.signInWithPassword({ email: email.trim(), password }));
}

export async function signOut() {
  return authResult(() => supabase.auth.signOut({ scope: 'local' }));
}

export async function getSession() {
  const data = await authResult(() => supabase.auth.getSession());
  return data.session;
}

// Sends Supabase's password-recovery email; the link lands the user on
// /reset-password with a recovery session already established.
export async function requestPasswordReset(email) {
  return authResult(() => supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  }));
}

export async function updatePassword(newPassword) {
  return authResult(() => supabase.auth.updateUser({ password: newPassword }));
}

export async function resendConfirmation(email) {
  return authResult(() => supabase.auth.resend({
    type: 'signup', email: email.trim(),
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  }));
}
