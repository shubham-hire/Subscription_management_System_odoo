import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

/**
 * Integration (Supertest) config. Runs against a disposable `brightloop_test`
 * database — never the dev/demo DB. `npm run test:integration` resets it first.
 *
 * SWC transform is required: vitest's default esbuild does not emit decorator
 * metadata, so Nest's constructor-based DI resolves `undefined` for guard
 * and service dependencies (Reflector, JwtService, PrismaService...).
 */
export default defineConfig({
  test: {
    include: ['test/**/*.e2e.spec.ts'],
    environment: 'node',
    env: {
      DATABASE_URL: 'postgresql://brightloop:brightloop@localhost:5432/brightloop_test?schema=public',
    },
    testTimeout: 30_000,
    hookTimeout: 90_000,
    fileParallelism: false, // sequential — tests share DB state
  },
  plugins: [
    swc.vite({ module: { type: 'es6' } }),
  ],
});
