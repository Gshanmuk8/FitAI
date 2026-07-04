import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || '';

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${session.access_token}` };
}

// Parse a response as JSON without exploding on empty or non-JSON bodies.
// A misconfigured VITE_API_URL makes /api/* calls land on the frontend
// origin, which returns index.html ("<!DOCTYPE ...>") — parsing that raw
// would surface a cryptic "Unexpected token '<'" instead of the real cause.
async function parseResponse(res) {
  const body = await res.text();
  let json;
  try {
    json = body ? JSON.parse(body) : null;
  } catch {
    if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
    throw new Error(
      `Expected JSON from ${res.url} but got a non-JSON response. ` +
      'Check that VITE_API_URL points at the backend API, not the frontend.'
    );
  }
  if (!res.ok) throw new Error(json?.error || `Request failed: ${res.status}`);
  return json;
}

export async function apiFetch(path, options = {}) {
  const headers = await authHeader();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...headers, ...options.headers },
  });
  return parseResponse(res);
}

// For multipart (image upload) requests — no Content-Type override, let
// the browser set the multipart boundary.
export async function apiUpload(path, formData) {
  const headers = await authHeader();
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: formData });
  return parseResponse(res);
}
