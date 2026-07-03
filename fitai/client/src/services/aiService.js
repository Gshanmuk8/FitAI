import { apiFetch } from '../utils/apiClient';

export function askTutor(mode, question, history = []) {
  return apiFetch('/api/ai/tutor', { method: 'POST', body: JSON.stringify({ mode, question, history }) });
}

export function submitOnboarding(profile) {
  return apiFetch('/api/onboarding', { method: 'POST', body: JSON.stringify(profile) });
}
