import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { validateClientConfig } from './src/utils/clientConfig.js';

export default defineConfig({
  plugins: [react(), {
    name: 'validate-fitai-config',
    configResolved(config) {
      const problems = validateClientConfig(loadEnv(config.mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_'));
      if (problems.length) throw new Error(`FitAI configuration: ${problems.join('; ')}. See client/.env.example.`);
    },
  }],
  server: {
    port: 5173,
    // Lets the dev client call the API without CORS friction when
    // VITE_API_URL is left empty.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
