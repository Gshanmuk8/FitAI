import { apiFetch } from '../utils/apiClient';

export function getMemoryTimeline() {
  return apiFetch('/api/memory/summaries');
}
