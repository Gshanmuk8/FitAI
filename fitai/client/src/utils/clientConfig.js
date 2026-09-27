export function validateClientConfig(env) {
  const problems = [];
  for (const key of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
    if (!env[key]?.trim() || /your-|changeme/i.test(env[key])) problems.push(`${key} is missing or is a placeholder`);
  }
  for (const key of ['VITE_SUPABASE_URL', 'VITE_API_URL']) {
    if (!env[key]?.trim()) continue;
    try {
      const url = new URL(env[key].trim());
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
      if (key === 'VITE_API_URL' && url.pathname.replace(/\/+$/, '')) {
        problems.push('VITE_API_URL must be the backend origin, without /api or another path');
      }
    } catch { problems.push(`${key} must be a complete HTTP(S) URL`); }
  }
  const key = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (key?.startsWith('sb_secret_')) problems.push('The frontend requires a public Supabase key, never a secret key');
  if (key?.split('.').length === 3) {
    try {
      const claims = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (claims.role !== 'anon') problems.push('The frontend requires the anon key, never the service-role key');
      if (claims.ref && new URL(env.VITE_SUPABASE_URL).hostname.endsWith('.supabase.co') &&
          new URL(env.VITE_SUPABASE_URL).hostname !== `${claims.ref}.supabase.co`) {
        problems.push('The Supabase URL and public key refer to different projects');
      }
    } catch { problems.push('The Supabase public key or project URL is invalid'); }
  }
  return problems;
}
