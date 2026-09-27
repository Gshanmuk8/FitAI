// Read-only deployment diagnostics. Never prints API keys, sessions or passwords.
async function main() {
  for (const url of ['https://fit-ai-teal-nu.vercel.app/signup', 'https://fitai-d94m.onrender.com/health']) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      const body = await response.text();
      const result = { url, status: response.status };
      if (url.endsWith('/health')) {
        try {
          const data = JSON.parse(body);
          result.health = { status: data.status, database: data.database };
        } catch { result.contentType = response.headers.get('content-type'); }
      } else {
        result.assets = [];
        for (const match of body.matchAll(/src="([^"]+\.js)"/g)) {
          const asset = await fetch(new URL(match[1], url), { signal: AbortSignal.timeout(12000) });
          const source = await asset.text();
          result.assets.push({
            path: match[1],
            supabaseHosts: [...new Set(source.match(/https:\/\/[a-z0-9]+\.supabase\.co/g) || [])],
          });
        }
      }
      console.log(JSON.stringify(result));
    } catch (error) {
      console.log(JSON.stringify({ url, error: error.message, cause: error.cause?.code }));
    }
  }
}
main();
