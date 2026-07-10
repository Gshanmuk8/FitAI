import { apiFetch } from '../utils/apiClient';

export function logSet(payload) {
  return apiFetch('/api/workout/log', { method: 'POST', body: JSON.stringify(payload) });
}

export function getProgression(exerciseName) {
  return apiFetch(`/api/workout/progression/${encodeURIComponent(exerciseName)}`);
}

// { [exerciseName]: setsLoggedToday } — session rehydration after refresh.
export function getTodaySets() {
  return apiFetch('/api/workout/today-sets');
}

export function getTodayChecklist() {
  return apiFetch('/api/checklist/today');
}

export function updateChecklistItem(field, value) {
  return apiFetch('/api/checklist/today', { method: 'PATCH', body: JSON.stringify({ field, value }) });
}

// Manual value entry: { protein_grams?, water_ml?, sleep_hours?, steps_count?, weight_kg?, notes? }
export function updateChecklistValues(values) {
  return apiFetch('/api/checklist/today/values', { method: 'PATCH', body: JSON.stringify(values) });
}

// User-authored mission items (free text) — each call returns the full
// updated checklist row so the UI can reconcile in one go.
export function addCustomChecklistItem(label) {
  return apiFetch('/api/checklist/today/custom', { method: 'POST', body: JSON.stringify({ label }) });
}

export function toggleCustomChecklistItem(id, done) {
  return apiFetch(`/api/checklist/today/custom/${id}`, { method: 'PATCH', body: JSON.stringify({ done }) });
}

export function removeCustomChecklistItem(id) {
  return apiFetch(`/api/checklist/today/custom/${id}`, { method: 'DELETE' });
}

export function getChecklistHistory(days = 28) {
  return apiFetch(`/api/checklist/history?days=${days}`);
}
