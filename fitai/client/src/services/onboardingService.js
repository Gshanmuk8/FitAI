import { apiFetch } from '../utils/apiClient';

// Onboarding is "complete" when the user has a profile AND a generated plan.
// GET /api/onboarding returns { profile, plan }, or 404 ("No profile found")
// before onboarding — which apiFetch surfaces as a thrown error. We treat that
// specific case as "not onboarded" and let any other error (network, expired
// session) propagate so callers don't misroute a transient failure.
export async function isOnboarded() {
  try {
    const data = await apiFetch('/api/onboarding');
    return Boolean(data?.plan);
  } catch (err) {
    if (/no profile found/i.test(err.message)) return false;
    throw err;
  }
}
