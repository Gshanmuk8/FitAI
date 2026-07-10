import { apiFetch } from '../utils/apiClient';

export function askTutor(mode, question, history = []) {
  return apiFetch('/api/ai/tutor', { method: 'POST', body: JSON.stringify({ mode, question, history }) });
}

// The dashboard's once-per-day AI progress briefing (server caches it 24h).
export function getDailyBriefing() {
  return apiFetch('/api/ai/briefing');
}

export function submitOnboarding(profile) {
  return apiFetch('/api/onboarding', { method: 'POST', body: JSON.stringify(profile) });
}
