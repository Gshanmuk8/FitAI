import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || '';

const SESSION_EXPIRED = 'Your session has expired — please log in again.';

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error(SESSION_EXPIRED);
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

// A 401 mid-session means the server rejected a token the browser still
// holds (revoked session, password changed elsewhere). Try one silent
// refresh + retry; if that fails, sign out — onAuthStateChange clears the
// user and ProtectedRoute bounces to /login — and surface a human message
// instead of a raw "Invalid or expired token".
async function fetchWithAuthRetry(makeRequest) {
  let res = await makeRequest();
  if (res.status === 401) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data?.session?.access_token) {
      res = await makeRequest();
    }
    if (res.status === 401) {
      await supabase.auth.signOut().catch(() => {});
      throw new Error(SESSION_EXPIRED);
    }
  }
  return parseResponse(res);
}

export async function apiFetch(path, options = {}) {
  return fetchWithAuthRetry(async () => {
    const headers = await authHeader();
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...headers, ...options.headers },
    });
  });
}

// For multipart (image upload) requests — no Content-Type override, let
// the browser set the multipart boundary.
export async function apiUpload(path, formData) {
  return fetchWithAuthRetry(async () => {
    const headers = await authHeader();
    return fetch(`${API_URL}${path}`, { method: 'POST', headers, body: formData });
  });
}
