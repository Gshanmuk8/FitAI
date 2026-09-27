import { isTemporaryAuthError } from './authErrors.js';

const SESSION_EXPIRED = 'Your session has expired — please log in again.';

// Requests carry a status so callers can branch on WHAT went wrong instead
// of regex-matching the server's prose. Pages used to test
// /no profile found/i to decide whether to send someone to onboarding —
// one reworded server string would have silently pushed established users
// back through signup, restarting their goal clock.
export class ApiError extends Error {
  constructor(message, { status = 0, noProfile = false, noPlan = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.noProfile = noProfile;
    this.noPlan = noPlan;
  }
}

// AI routes run a provider cascade; the rest should fail fast rather than
// leave a disabled form spinning forever behind a dropped connection.
const AI_PATHS = /^\/api\/(ai|progress|onboarding|plan\/regenerate|nutrition\/analyze)/;
const timeoutFor = (path) => (AI_PATHS.test(path) ? 120000 : 20000);

export function createApiClient({ auth, apiUrl = '', fetchImpl = globalThis.fetch, timeoutMs }) {
const API_URL = apiUrl.trim().replace(/\/+$/, '');
let refreshInFlight;

function refreshOnce() {
  if (!refreshInFlight) {
    refreshInFlight = auth.refreshSession().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function authHeader() {
  const { data: { session }, error } = await auth.getSession();
  if (error) throw error;
  if (!session?.access_token) throw new ApiError(SESSION_EXPIRED, { status: 401 });
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
    if (!res.ok) throw new ApiError(`Request failed: ${res.status} ${res.statusText}`, { status: res.status });
    throw new ApiError(
      `Expected JSON from ${res.url} but got a non-JSON response. ` +
      'Check that VITE_API_URL points at the backend API, not the frontend.',
      { status: res.status }
    );
  }
  if (!res.ok) {
    const message = json?.error || `Request failed: ${res.status}`;
    // The two 404s the UI routes on. Classified once, here, so no page has
    // to know the server's exact wording.
    throw new ApiError(message, {
      status: res.status,
      noProfile: res.status === 404 && /no profile found/i.test(message),
      noPlan: res.status === 404 && /no plan found/i.test(message),
    });
  }
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
    const { data, error } = await refreshOnce();
    if (isTemporaryAuthError(error)) {
      throw new ApiError('The account service is temporarily unavailable. Please try again shortly.', { status: 503 });
    }
    const refreshed = !error && data?.session?.access_token;
    if (refreshed) res = await makeRequest();

    if (res.status === 401) {
      // Only tear down the session when the refresh itself says the grant is
      // dead. A 401 that survives a SUCCESSFUL refresh is far more likely to
      // be the auth service having a blip than the user being logged out —
      // and signing out mid-form loses whatever they were typing on
      // Onboarding, Plan or Tutor, none of which persist a draft.
      if (!refreshed) {
        await auth.signOut({ scope: 'local' }).catch(() => {});
        throw new ApiError(SESSION_EXPIRED, { status: 401 });
      }
      throw new ApiError(
        'Could not verify your session just now — please try that again.',
        { status: 401 }
      );
    }
  }
  return parseResponse(res);
}

// Abort rather than hang forever: a cold server or a dropped connection
// would otherwise leave a submit button disabled with no way out but a
// reload, which on Onboarding means retyping the whole form.
async function withTimeout(path, makeRequest) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? timeoutFor(path));
  const { signal } = controller;
  const timeout = new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Request timed out', 'TimeoutError')), { once: true });
  });
  try {
    return await Promise.race([fetchWithAuthRetry(() => makeRequest(signal)), timeout]);
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new ApiError('That took longer than expected — check your connection and try again.', { status: 0 });
    }
    if (err instanceof ApiError) throw err;
    if (isTemporaryAuthError(err) || err instanceof TypeError) {
      throw new ApiError('We cannot reach FitAI right now. Check your connection and try again shortly.', { status: 0 });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function apiFetch(path, options = {}) {
  return withTimeout(path, async (signal) => {
    const headers = await authHeader();
    return fetchImpl(`${API_URL}${path}`, {
      ...options,
      signal,
      headers: { 'Content-Type': 'application/json', ...headers, ...options.headers },
    });
  });
}

// For multipart (image upload) requests — no Content-Type override, let
// the browser set the multipart boundary.
async function apiUpload(path, formData) {
  return withTimeout(path, async (signal) => {
    const headers = await authHeader();
    return fetchImpl(`${API_URL}${path}`, { method: 'POST', headers, body: formData, signal });
  });
}

return { apiFetch, apiUpload };
}
