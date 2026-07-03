import { apiFetch, apiUpload } from '../utils/apiClient';

export function analyzeFoodImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  return apiUpload('/api/nutrition/analyze', formData);
}

export function saveMeal(meal) {
  return apiFetch('/api/nutrition/meals', { method: 'POST', body: JSON.stringify(meal) });
}

export function getTodayMeals() {
  return apiFetch('/api/nutrition/meals/today');
}

export function deleteMeal(id) {
  return apiFetch(`/api/nutrition/meals/${id}`, { method: 'DELETE' });
}
