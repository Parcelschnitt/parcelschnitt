import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Content Security Policy. GitHub Pages cannot send headers, so the policy is delivered as a
 * <meta> tag. The production policy forbids every network connection (`connect-src 'none'`)
 * and every inline script or style.
 */
const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'none'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** Dev server only: Vite injects styles at runtime and needs a WebSocket for hot reload. */
const DEV_CSP = PRODUCTION_CSP.replace(
  "style-src 'self'",
  "style-src 'self' 'unsafe-inline'",
).replace("connect-src 'none'", "connect-src 'self' ws:");

function contentSecurityPolicy(): Plugin {
  return {
    name: 'parcelschnitt-csp',
    transformIndexHtml(_html, context) {
      return [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: context.server ? DEV_CSP : PRODUCTION_CSP,
          },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig({
  // Relative asset paths: the site works under any GitHub Pages sub-path.
  base: './',
  plugins: [contentSecurityPolicy()],
  build: {
    target: 'es2023',
    sourcemap: false,
    modulePreload: { polyfill: false },
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
