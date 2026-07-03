import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || '';

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function apiFetch(path, options = {}) {
  const headers = await authHeader();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...headers, ...options.headers },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Request failed: ${res.status}`);
  return json;
}

// For multipart (image upload) requests — no Content-Type override, let
// the browser set the multipart boundary.
export async function apiUpload(path, formData) {
  const headers = await authHeader();
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: formData });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Request failed: ${res.status}`);
  return json;
}
