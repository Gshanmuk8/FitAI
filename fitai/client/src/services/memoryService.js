import { apiFetch } from "../utils/apiClient";

export function getMemoryTimeline() {
  return apiFetch("/api/memory/summaries?limit=200");
}

export function deleteMemory(id) {
  return apiFetch(`/api/memory/summaries/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
