import { apiFetch, apiUpload } from '../utils/apiClient';
import { prepareFoodImage } from '../utils/imageProcessing';

export async function analyzeFoodImage(file) {
  // Downscale before upload: raw phone photos exceed provider payload
  // limits (the top cause of "couldn't read that image") and waste mobile
  // data. Best-effort — an undecodable format uploads as-is.
  const prepared = await prepareFoodImage(file);
  const formData = new FormData();
  formData.append('image', prepared);
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
