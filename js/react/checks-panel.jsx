/* The Checks tab's scored rule list, as a React + MUI island.

   Role: renders what `renderPageChecksPanel()` in
   js/ux-improvements-state-sync.js used to build with a template string. That
   function still owns WHEN to render, WHICH page to score, and the
   plain-language advisory section below this one; this file owns only the
   markup for the scored list and the page-facts list.

   Load-order dependency: none — it is imported by its caller.

   **This is the first `.jsx` file in the repo.** Everything else under `js/`
   is plain browser JS with no build-time syntax, so the extension is the
   signal that a file needs the React plugin in `vite.config.mjs` to compile
   at all. Keep new components under `js/react/` so that boundary stays
   visible in the tree rather than only in the extension.

   **The legacy class names are kept deliberately.** `.compliance-item`,
   `.compliance-rule`, `.compliance-citation` and friends are styled by
   css/dashboard.css and asserted on by tests/e2e/review-workflow.spec.js,
   which reads the citation text to prove a failed mandate still names its
   source. Renaming them to something MUI-idiomatic in the same change that
   introduces MUI would make a styling regression and a test failure
   indistinguishable. */

import Chip from '@mui/material/Chip'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { ensureIslandHost, renderIsland } from './mount.js'

/**
 * One scored or unscored rule row.
 *
 * @param {{rule: {label: string, detail: string, citation?: string, pass: boolean}}} props
 */
function RuleItem({ rule }) {
  return (
    <ListItem
      className={`compliance-item ${rule.pass ? 'pass' : 'warn'}`}
      disableGutters
      // These multipliers are counted in --ds-space steps, which is what the
      // theme's spacing factor of 4 now makes them: gap 2 is 8px, the same
      // --ds-space-2 that css/ux-improvements.css declares on
      // `.compliance-item`, and py 1 is --ds-space-1. They read 1 and 0.5
      // before the factor moved, meaning the same pixels under MUI's default
      // factor of 8 — so this is holding the rendering still across a change
      // of unit, not retuning the row.
      sx={{ alignItems: 'flex-start', gap: 2, py: 1 }}
    >
      <Chip
        size="small"
        label={rule.pass ? 'Pass' : 'Check'}
        color={rule.pass ? 'success' : 'warning'}
        variant="outlined"
        // Step 1 rather than the 0.15rem literal this carried, for the same
        // reason the spacing sweep replaced that class of value in the
        // stylesheets: it is the same optical nudge, 1.6px larger, and it is
        // what `.compliance-item::before` already uses to align its own dot.
        sx={{ mt: 1, flex: '0 0 auto' }}
      />
      <span>
        <span className="compliance-rule">{rule.label}</span>
        {rule.citation ? <span className="compliance-citation">{rule.citation}</span> : null}
        <span className="compliance-detail">{rule.detail}</span>
      </span>
    </ListItem>
  )
}

/**
 * The Checks panel's scored section.
 *
 * Every value is passed in rather than read from a global on mount. That is
 * not just tidiness: the page being scored is resolved by the caller as
 * `(pageKey && DATA.pages[pageKey]) || getCurrentPage()`, in that order,
 * because `#pageSelect.value` is still on its first option while the initial
 * View Transition is in flight. A component that read the current page for
 * itself would reintroduce exactly the bug that precedence documents — a
 * reviewer who left the Checks tab open coming back to another page's scores.
 *
 * @param {object} props
 * @param {string} props.pageTitle Title of the page being scored.
 * @param {Array<object>} props.rules Scored rules, failures already first.
 * @param {Array<object>} props.facts Unscored schema-guaranteed rules.
 * @param {number} props.passed How many scored rules pass.
 */
function ChecksPanel({ pageTitle, rules, facts, passed }) {
  return (
    <Paper component="section" className="compliance-panel" sx={{ background: 'transparent' }}>
      <Typography variant="h3" component="h3">
        Checks for this page
      </Typography>
      <Typography variant="body2" component="p" className="review-decision-note">
        <strong>{pageTitle}</strong> — {passed} of {rules.length} checks passing. For every page at
        once, use the <strong>Overview</strong> tab. Search metadata values update as you edit them
        in the sidebar.
      </Typography>
      <List className="compliance-list" dense disablePadding>
        {rules.map((rule) => (
          <RuleItem key={rule.label} rule={rule} />
        ))}
      </List>
      {facts.length ? (
        <>
          <Typography variant="h4" component="h4" className="compliance-subhead">
            Page facts
          </Typography>
          <Typography variant="body2" component="p" className="review-decision-note">
            Required by the page schema, so they cannot fail here — shown for reference, not scored.
          </Typography>
          <List className="compliance-list compliance-list--facts" dense disablePadding>
            {facts.map((rule) => (
              <RuleItem key={rule.label} rule={rule} />
            ))}
          </List>
        </>
      ) : null}
    </Paper>
  )
}

/**
 * Mount (or re-render) the scored section inside the Checks panel.
 *
 * The island gets its own child element rather than owning the panel, because
 * the advisory plain-language section beside it is still built by replacing
 * `innerHTML` — which would tear a React root out from under itself.
 *
 * @param {Element|null} panel The `#reviewChecksPanel` element.
 * @param {object} props Props for `ChecksPanel`.
 * @returns {void}
 */
function mountChecksPanel(panel, props) {
  const host = ensureIslandHost(panel, 'reviewChecksIsland')
  renderIsland(host, <ChecksPanel {...props} />)
}

export { ChecksPanel, mountChecksPanel }
