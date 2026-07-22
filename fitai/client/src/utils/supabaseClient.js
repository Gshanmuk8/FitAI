import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Without these, createClient() throws "supabaseUrl is required" at import
// time — which happens before React (and the ErrorBoundary) mounts, so the
// whole app is a blank white screen with only that cryptic line in the
// console. Fail with a diagnostic that names the missing var and the fix,
// matching how apiClient.js reports a misconfigured VITE_API_URL. The anon
// key is public by design, so surfacing which var is unset leaks nothing.
if (!url || !anonKey) {
  const missing = [!url && 'VITE_SUPABASE_URL', !anonKey && 'VITE_SUPABASE_ANON_KEY']
    .filter(Boolean)
    .join(' and ');
  throw new Error(
    `Supabase is not configured: ${missing} is missing. Set it in the ` +
    `frontend deploy's environment (see client/.env.example) and rebuild — ` +
    `auth cannot work without it.`
  );
}

export const supabase = createClient(url, anonKey);
