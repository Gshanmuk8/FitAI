import { apiFetch } from '../utils/apiClient';

export function getPlan() {
  return apiFetch('/api/plan');
}

export function updatePlan(update) {
  return apiFetch('/api/plan', { method: 'PUT', body: JSON.stringify(update) });
}
