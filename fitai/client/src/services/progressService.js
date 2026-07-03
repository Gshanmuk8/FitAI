import { apiFetch } from '../utils/apiClient';

export function getProgressReport() {
  return apiFetch('/api/progress');
}

export function logWeight(weightKg) {
  return apiFetch('/api/progress/weight', { method: 'POST', body: JSON.stringify({ weightKg }) });
}

export function getWeights(days = 90) {
  return apiFetch(`/api/progress/weights?days=${days}`);
}

export function getAchievements() {
  return apiFetch('/api/achievements');
}

export function getReview(period = 'weekly') {
  return apiFetch(`/api/reviews?period=${period}`);
}
