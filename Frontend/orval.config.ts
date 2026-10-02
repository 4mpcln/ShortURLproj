import { defineConfig } from 'orval';

export default defineConfig({
  shortUrl: {
    input: '../Backend/openapi.json',
    output: {
      mode: 'single',
      target: './src/api/generated/shortUrl.ts',
      client: 'axios',
      prettier: true,
      override: {
        mutator: {
          path: './src/api/http.ts',
          name: 'apiClient',
        },
      },
    },
  },
});
