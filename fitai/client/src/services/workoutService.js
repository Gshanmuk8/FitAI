import { apiFetch } from '../utils/apiClient';

export function logSet(payload) {
  return apiFetch('/api/workout/log', { method: 'POST', body: JSON.stringify(payload) });
}

export function getProgression(exerciseName) {
  return apiFetch(`/api/workout/progression/${encodeURIComponent(exerciseName)}`);
}

export function getTodayChecklist() {
  return apiFetch('/api/checklist/today');
}

export function updateChecklistItem(field, value) {
  return apiFetch('/api/checklist/today', { method: 'PATCH', body: JSON.stringify({ field, value }) });
}
