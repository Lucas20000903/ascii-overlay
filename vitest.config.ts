import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// React tests opt into jsdom with a `@vitest-environment jsdom` docblock;
// everything else runs in plain node.
export default defineConfig({
  plugins: [react()],
  test: { environment: 'node' },
});
