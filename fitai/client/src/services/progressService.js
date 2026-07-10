import { apiFetch } from '../utils/apiClient';

// { date, data: { goal, weighIns, adherence, training, nutrition }, analysis }
export function getProgress() {
  return apiFetch('/api/progress');
}
