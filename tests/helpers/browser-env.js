/* Registers a real DOM into the Bun test process, preloaded before any test
   file runs (see the `preload` key in bunfig.toml).

   This replaces tests/helpers/load-scripts.js, which used vm.runInContext to
   evaluate the classic <script> files into one shared context with a
   hand-written four-method DOM stub. That harness only worked while js/*.js
   were scripts sharing a global scope; as ES modules they are evaluated by
   the module loader, not by us, so the modules have to find a browser-shaped
   global environment already in place rather than being handed one.

   happy-dom is used rather than a stub because the module graph now pulls in
   real work at import time: js/state.js reads window.HHVC_DATA (populated by
   js/page-data.js importing all 19 pages/*.js), and several modules touch
   document/localStorage while mounting. Faking each of those individually is
   how the old stub grew its long tail of `getElementById() { return {} }`
   shims; a real DOM removes that class of maintenance entirely and makes the
   assertions closer to what the browser actually does. */

const { GlobalRegistrator } = require('@happy-dom/global-registrator')

/* happy-dom swaps in its own fetch/Request/Response/Headers, routed through
   its internal HTTP client so a virtual page can be given virtual responses.
   That is the wrong behavior for this suite: tests/review-api-server.test.js
   spawns the real server.ts against a temp SQLite database and exercises
   auth, merging and per-page isolation over actual HTTP, and under
   happy-dom's client those requests fail with ECONNREFUSED.

   Bun's native implementations are captured before registration and put back
   afterwards. Nothing in js/*.js depends on fetch being DOM-flavoured — the
   sync client in js/review-state-sync.js calls plain fetch() and stubs it
   wholesale in its own tests — so the real one is both more correct here and
   closer to what the browser actually does. */
const nativeNetworking = {
  fetch: globalThis.fetch,
  Request: globalThis.Request,
  Response: globalThis.Response,
  Headers: globalThis.Headers,
  FormData: globalThis.FormData,
}

GlobalRegistrator.register({ url: 'http://localhost:8080/' })

for (const [name, value] of Object.entries(nativeNetworking)) {
  if (!value) continue
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
  })
}

/* happy-dom installs `window`, `document` and `localStorage` as accessor
   properties with a getter and no setter. That makes them silently
   unassignable: `global.localStorage = fake` throws in strict mode and is a
   no-op in sloppy mode, so a test's stub never takes effect and the module
   under test keeps talking to the real happy-dom storage.

   tests/review-state-sync.test.js depends on replacing exactly these three —
   it mounts the sync client against a fake window and a Map-backed
   localStorage to drive pull/push/conflict paths without a server. Its
   beforeEach/afterEach already save and restore the originals (the repo's
   rule for anything that stubs a global, after a leaked stub once made every
   later fetch() in the process return that file's last mock response), so
   the only thing missing is permission to assign at all.

   Redefining them as writable data properties grants exactly that, and
   changes nothing about their values or behavior otherwise. */
for (const name of ['window', 'document', 'localStorage', 'sessionStorage']) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
  if (!descriptor || descriptor.writable) continue
  Object.defineProperty(globalThis, name, {
    value: globalThis[name],
    writable: true,
    configurable: true,
    enumerable: descriptor.enumerable ?? false,
  })
}

/* happy-dom implements localStorage, and bun:test runs every test file in ONE
   process — so a review written by one test stays visible to every test that
   follows, in that file and in later files.

   This has to be an afterEach hook, not a bare call. A preload script runs
   once, before the first test file is loaded, so clearing at the top level
   only guarantees a clean slate for the very first test in the run; every
   test after it would inherit whatever its predecessors wrote. Hooks
   registered from a preload apply to the whole suite, which is what actually
   enforces the isolation.

   Clearing AFTER each test rather than before means a test that wants to seed
   storage can still do so in its own setup without this hook wiping it. */
const { afterEach } = require('bun:test')

afterEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear()
})
