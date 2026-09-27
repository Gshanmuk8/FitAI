import { supabase } from './supabaseClient';
import { createApiClient } from './apiTransport';

export { ApiError } from './apiTransport';
export const { apiFetch, apiUpload } = createApiClient({
  auth: supabase.auth,
  apiUrl: import.meta.env.VITE_API_URL || '',
});
