import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import react from '@vitejs/plugin-react'
import { codecovVitePlugin } from '@codecov/vite-plugin'

/* Build config for the manager-review tool.

   Two outputs come out of this one config, selected by mode:

   - `vite build` (default) writes a normal hashed-asset bundle to dist/,
     which is what Railway deploys and what server.ts serves in production.
   - `vite build --mode singlefile` inlines every script and stylesheet into
     one self-contained dist-singlefile/index.html. That replaces the old
     hand-rolled build_scripts/build-single-file.js, which walked index.html's
     <script>/<link> tags in document order and concatenated them by hand —
     an approach that only worked while the tool had no bundler.

   The single-file plugin's documented limitation is that it does not support
   multi-page apps. That does not bite here: this tool is genuinely one
   index.html, and the sub-app under forms/mosquito-workshop-request builds
   independently with its own Vite config. */

export default defineConfig(({ mode }) => ({
  // Relative base so the built index.html works when opened from the file
  // system or served from a sub-path, not just from a domain root. The
  // single-file export in particular is meant to be emailed around and
  // double-clicked.
  base: './',
  plugins: [
    react(),
    ...(mode === 'singlefile' ? [viteSingleFile()] : []),
    // Bundle-size reporting to Codecov. Last in the array on purpose — the
    // plugin measures the finished bundle, so anything that rewrites output
    // has to run before it.
    //
    // The gate is CI, NOT token presence. Codecov's own onboarding snippet
    // reads `process.env.CODECOV_TOKEN !== undefined`, which assumes a token
    // exists — and this repository is PUBLIC, so uploads can be tokenless
    // (Codecov skips the token check when a public repo's organization has
    // disabled token authentication). Under that setup `CODECOV_TOKEN` is
    // never set, the onboarding gate is permanently false, and bundle
    // analysis silently never runs: no error, no output, just a dependency
    // doing nothing. Gating on CI keeps it working whether or not a token is
    // configured.
    //
    // It also keeps the cost off local builds. Measured on Vite 8.2.0:
    // 410ms with the plugin disabled, 6.13s with it enabled — and rolldown
    // reports the difference itself via `[PLUGIN_TIMINGS]`. `uploadToken`
    // stays wired because a token is still honoured if one is present, and
    // ignored outright when the upload qualifies as tokenless.
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CI === 'true',
      bundleName: 'hhvc-manager-review',
      uploadToken: process.env.CODECOV_TOKEN,
    }),
  ],
  build: {
    outDir: mode === 'singlefile' ? 'dist-singlefile' : 'dist',
    emptyOutDir: true,
    // ECharts trips Rollup's default 500 kB warning: its lazy-loaded chunk is
    // ~502 kB and the app chunk ~466 kB. Raise the threshold rather than
    // silence the warning, so a genuinely surprising jump still gets flagged.
    //
    // 600, not 1500. The old value was set when Web Awesome was also expected
    // in the bundle; that dependency was never imported and has been removed,
    // which left the limit roughly 3x larger than anything it guards — it
    // would not have flagged the app chunk tripling. 600 clears both current
    // chunks with headroom and still fires well before that.
    chunkSizeWarningLimit: 600,
  },
  server: {
    host: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT) || 8080,
    // The optional review-state sync API is served by server.ts (Bun +
    // SQLite), which Vite knows nothing about. Proxying /api keeps the sync
    // client, its settings UI, and tests/review-api-server.test.js working
    // against a single origin during development, exactly as they did when
    // server.ts served the static files itself.
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.API_PORT || 8081}`,
        changeOrigin: true,
      },
    },
  },
}))
