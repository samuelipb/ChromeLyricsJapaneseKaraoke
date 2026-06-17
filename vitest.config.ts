import { defineConfig } from 'vitest/config';

// Tests unitarios deterministas (mockea red; sin pegar a LRCLIB). Ver rules/testing.md.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
