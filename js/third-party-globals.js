/* Publishes the three third-party libraries onto `window`.

   These used to arrive as browser globals — papaparse straight from
   node_modules, Fuse and defu as committed IIFE bundles under js/vendor/
   rebuilt by a `vendor:browser` script. Vite imports them from npm now, so
   js/vendor/ and that script are gone.

   Their consumers still reach for them as globals behind
   `typeof X === 'undefined'` guards: js/utils.js's parseCsv, the fuzzy search
   in js/review-queue-rows.js, and the backup merge in
   js/ux-improvements-export.js. Those guards are the documented fallback that
   keeps each feature degrading to a simpler implementation rather than
   throwing, and the Node-side tests exercise exactly that path, so the
   globals stay and no consumer needed editing.

   WHY THIS IS A SEPARATE MODULE RATHER THAN A FEW LINES IN js/main.js:
   ES module evaluation runs every static import of a module before any
   statement in that module's own body. So `window.Fuse = Fuse` written
   directly in js/main.js would execute AFTER every module js/main.js imports
   had already evaluated — including js/review-queue.js, whose init() runs on
   evaluation and re-renders the queue immediately when a reviewer reloads
   with the workspace already open on Overview. With a saved search query,
   that first render would silently fall back to substring matching because
   `Fuse` was still undefined, and assigning it a moment later triggers no
   re-render, so fuzzy matches stayed missing until the next interaction.

   Being its own module makes the assignment part of the import phase: place
   this first in js/main.js's import list and the globals exist before any
   consumer evaluates. The fix is the module boundary, not the line order —
   moving these statements back inline would reintroduce the bug.

   Load-order dependency: must be imported before any module that reads these
   globals, i.e. first in js/main.js. */

import Papa from 'papaparse'
import Fuse from 'fuse.js'
import { defu } from 'defu'

window.Papa = Papa
window.Fuse = Fuse
window.defu = defu
