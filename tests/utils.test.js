import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

// js/core/utils.js is an ES module now, so its helpers are imported directly
// instead of being evaluated into a vm context by the old load-scripts
// harness. `ctx` is kept as the local name so the assertions below read
// unchanged.
import * as ctx from '../js/core/utils.js'
import { getByPath, setByPath, REVIEW_RECORD_FIELDS, buildReviewRecord } from '../js/core/utils.js'

describe('safeUrl', () => {
  test('passes through absolute http and https URLs unchanged', () => {
    expect(ctx.safeUrl('https://sf.gov/a?b=c#d')).toBe('https://sf.gov/a?b=c#d')
    expect(ctx.safeUrl('http://example.test')).toBe('http://example.test')
  })

  test('passes through mailto and tel URLs', () => {
    expect(ctx.safeUrl('mailto:hhvc@sfdph.org')).toBe('mailto:hhvc@sfdph.org')
    expect(ctx.safeUrl('tel:+14155551212')).toBe('tel:+14155551212')
  })

  test('passes through root-relative paths', () => {
    expect(ctx.safeUrl('/forms/mosquito-workshop-request/')).toBe(
      '/forms/mosquito-workshop-request/'
    )
  })

  test('replaces a javascript: URL with the inert sentinel', () => {
    expect(ctx.safeUrl('javascript:alert(1)')).toBe('#')
  })

  test('replaces a javascript: URL regardless of case or leading whitespace', () => {
    expect(ctx.safeUrl('JaVaScRiPt:alert(1)')).toBe('#')
    expect(ctx.safeUrl('   javascript:alert(1)')).toBe('#')
  })

  test('replaces a data: URL', () => {
    expect(ctx.safeUrl('data:text/html,<script>alert(1)</script>')).toBe('#')
  })

  // "//evil.example" reads as relative but inherits the page scheme and leaves
  // the origin, so it must not be treated like a root-relative path.
  test('replaces a protocol-relative URL', () => {
    expect(ctx.safeUrl('//evil.example/x')).toBe('#')
  })

  // A browser treats backslashes as forward slashes in the authority position:
  // new URL('\\\\evil.example', 'https://sf.gov') resolves to https://evil.example.
  // Checking only for "//" let every one of these leave the origin.
  test('replaces protocol-relative URLs written with backslashes', () => {
    expect(ctx.safeUrl('\\\\evil.example/path')).toBe('#')
    expect(ctx.safeUrl('\\/evil.example')).toBe('#')
    expect(ctx.safeUrl('/\\evil.example')).toBe('#')
  })

  test('treats empty, null, and undefined as the inert sentinel', () => {
    expect(ctx.safeUrl('')).toBe('#')
    expect(ctx.safeUrl(null)).toBe('#')
    expect(ctx.safeUrl(undefined)).toBe('#')
  })

  // Browsers strip control characters before resolving a URL, so a scheme
  // broken up by a tab or newline still executes.
  test('replaces a javascript: URL obfuscated with control characters', () => {
    expect(ctx.safeUrl('java\tscript:alert(1)')).toBe('#')
    expect(ctx.safeUrl('java\nscript:alert(1)')).toBe('#')
  })

  test('leaves an existing fragment sentinel alone', () => {
    expect(ctx.safeUrl('#')).toBe('#')
  })
})

describe('escapeHtml', () => {
  test('escapes all five HTML special characters', () => {
    expect(ctx.escapeHtml(`<script>alert('x')&"y"</script>`)).toBe(
      '&lt;script&gt;alert(&#039;x&#039;)&amp;&quot;y&quot;&lt;/script&gt;'
    )
  })

  test('treats null and undefined as empty string', () => {
    expect(ctx.escapeHtml(null)).toBe('')
    expect(ctx.escapeHtml(undefined)).toBe('')
  })

  test('leaves plain text unchanged', () => {
    expect(ctx.escapeHtml('Report rats or mice')).toBe('Report rats or mice')
  })

  test('coerces non-string values', () => {
    expect(ctx.escapeHtml(42)).toBe('42')
  })
})

describe('csvEscape', () => {
  test('leaves plain values unquoted', () => {
    expect(ctx.csvEscape('Report rats or mice')).toBe('Report rats or mice')
  })

  test('quotes values containing commas', () => {
    expect(ctx.csvEscape('rats, mice')).toBe('"rats, mice"')
  })

  test('quotes and doubles internal quotes', () => {
    expect(ctx.csvEscape('say "hi"')).toBe('"say ""hi"""')
  })

  test('quotes values containing newlines', () => {
    expect(ctx.csvEscape('line1\nline2')).toBe('"line1\nline2"')
  })

  test('neutralizes formula-injection prefixes with a leading apostrophe', () => {
    expect(ctx.csvEscape('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)")
    expect(ctx.csvEscape('+1234')).toBe("'+1234")
    expect(ctx.csvEscape('-1234')).toBe("'-1234")
    expect(ctx.csvEscape('@cmd')).toBe("'@cmd")
  })

  // Formerly a test.todo: csvEscape used to check the trimStart()ed value
  // for a leading tab/CR, but trimStart() strips tabs and CRs as whitespace,
  // so those prefix checks could never match. csvEscape now checks the raw
  // text for a leading tab/CR (while still checking the trimmed value for
  // =/+/-/@ so formulas hidden behind spaces stay caught).
  test('neutralizes a bare leading tab or carriage return', () => {
    expect(ctx.csvEscape('\tcmd')).toBe("'\tcmd")
    // The CR still needs outer quoting (comma/quote/newline rule), with the
    // protective apostrophe kept inside those quotes, same as the '=' case above.
    expect(ctx.csvEscape('\rcmd')).toBe('"' + "'\rcmd" + '"')
  })

  test('detects formula-injection prefixes after leading whitespace', () => {
    expect(ctx.csvEscape('   =SUM(A1:A9)')).toBe("'   =SUM(A1:A9)")
  })

  test('keeps the protective apostrophe inside quotes when also quoted', () => {
    expect(ctx.csvEscape('=SUM(A1,A2)')).toBe('"\'=SUM(A1,A2)"')
  })

  test('coerces null and undefined to empty string', () => {
    expect(ctx.csvEscape(null)).toBe('')
    expect(ctx.csvEscape(undefined)).toBe('')
  })
})

describe('toCsv', () => {
  test('joins escaped rows with commas and trailing newline', () => {
    const rows = [
      ['Page Key', 'Title'],
      ['reportRats', 'Report rats, mice'],
    ]
    expect(ctx.toCsv(rows)).toBe('Page Key,Title\nreportRats,"Report rats, mice"\n')
  })

  test('escapes every cell, not just the first', () => {
    const rows = [['=cmd', 'plain', 'has "quotes"']]
    expect(ctx.toCsv(rows)).toBe('\'=cmd,plain,"has ""quotes"""\n')
  })
})

describe('getPrimaryCta / setPrimaryCta', () => {
  function samplePage() {
    return {
      primaryCta: 'Fallback CTA',
      sections: [
        { heading: 'Intro', steps: [{ title: 'Step 1' }] },
        {
          heading: 'Report',
          steps: [{ title: 'Step 2', button: 'Report now' }],
          button: 'Section button',
        },
      ],
    }
  }

  test('finds the first step button across sections', () => {
    expect(ctx.getPrimaryCta(samplePage())).toBe('Report now')
  })

  test('falls back to a section button when no step has one', () => {
    const page = {
      sections: [{ heading: 'Report', button: 'Section only' }],
    }
    expect(ctx.getPrimaryCta(page)).toBe('Section only')
  })

  test('falls back to page.primaryCta when no section/step button exists', () => {
    const page = { sections: [{ heading: 'Intro' }], primaryCta: 'Fallback CTA' }
    expect(ctx.getPrimaryCta(page)).toBe('Fallback CTA')
  })

  test('falls back to spotlight.button before page.primaryCta', () => {
    const page = {
      sections: [{ heading: 'Intro' }],
      spotlight: { button: 'Report through 311' },
      primaryCta: 'Fallback CTA',
    }
    expect(ctx.getPrimaryCta(page)).toBe('Report through 311')
  })

  test('returns empty string when nothing is set', () => {
    expect(ctx.getPrimaryCta({ sections: [] })).toBe('')
    expect(ctx.getPrimaryCta({})).toBe('')
  })

  test('setPrimaryCta updates the first step button in place', () => {
    const page = samplePage()
    ctx.setPrimaryCta(page, 'New label')
    expect(page.sections[1].steps[0].button).toBe('New label')
    expect(page.sections[1].button).toBe('Section button')
  })

  test('setPrimaryCta falls back to page.primaryCta when no button exists anywhere', () => {
    const page = { sections: [{ heading: 'Intro' }], primaryCta: 'Old' }
    ctx.setPrimaryCta(page, 'New label')
    expect(page.primaryCta).toBe('New label')
  })

  test('setPrimaryCta writes spotlight.button, and getPrimaryCta round-trips it', () => {
    const page = {
      sections: [{ heading: 'Intro' }],
      spotlight: { button: 'Report through 311' },
      primaryCta: 'Old',
    }
    ctx.setPrimaryCta(page, 'New label')
    expect(page.spotlight.button).toBe('New label')
    expect(page.primaryCta).toBe('Old')
    expect(ctx.getPrimaryCta(page)).toBe('New label')
  })
})

describe('resolvePageKey', () => {
  const pageData = { pestsTopic: {}, filthReport: {}, rodentsReport: {} }
  const aliases = {
    raccoonInfo: 'rodentsReport',
    garbageReport: 'filthReport',
    deadEnd: 'noSuchPage',
  }

  test('returns the key unchanged when it already exists', () => {
    expect(ctx.resolvePageKey('filthReport', pageData, aliases)).toEqual({
      key: 'filthReport',
      status: 'ok',
      from: null,
    })
  })

  test('falls back to the default key when no key is given', () => {
    expect(ctx.resolvePageKey(null, pageData, aliases, 'pestsTopic')).toEqual({
      key: 'pestsTopic',
      status: 'ok',
      from: null,
    })
    expect(ctx.resolvePageKey(undefined, pageData, aliases, 'pestsTopic')).toEqual({
      key: 'pestsTopic',
      status: 'ok',
      from: null,
    })
  })

  test('follows the alias map for a retired key', () => {
    expect(ctx.resolvePageKey('raccoonInfo', pageData, aliases, 'pestsTopic')).toEqual({
      key: 'rodentsReport',
      status: 'aliased',
      from: 'raccoonInfo',
    })
  })

  test('falls back to the default key when the alias target does not exist', () => {
    expect(ctx.resolvePageKey('deadEnd', pageData, aliases, 'pestsTopic')).toEqual({
      key: 'pestsTopic',
      status: 'unknown',
      from: 'deadEnd',
    })
  })

  test('falls back to the default key for a completely unknown key', () => {
    expect(ctx.resolvePageKey('neverExisted', pageData, aliases, 'pestsTopic')).toEqual({
      key: 'pestsTopic',
      status: 'unknown',
      from: 'neverExisted',
    })
  })

  test('works with no aliases map at all', () => {
    expect(ctx.resolvePageKey('raccoonInfo', pageData, undefined, 'pestsTopic')).toEqual({
      key: 'pestsTopic',
      status: 'unknown',
      from: 'raccoonInfo',
    })
  })
})

describe('today', () => {
  test('returns an ISO-style YYYY-MM-DD date string', () => {
    expect(ctx.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('getDecisionChipClass', () => {
  test('gives each of the five decisions its own class', () => {
    // Regression: the previous mapping returned pass/warn/fail, so five
    // decisions drew as three colours. Uniqueness is the whole property.
    const decisions = [
      'Needs review',
      'Approved',
      'Approved with edits',
      'Revise and resubmit',
      'Blocked',
    ]
    const classes = decisions.map((decision) => ctx.getDecisionChipClass(decision))

    expect(new Set(classes).size).toBe(decisions.length)
  })

  test('keeps Blocked and Revise and resubmit distinct', () => {
    // The pair that matters most: Blocked is waiting on an outside party,
    // Revise and resubmit is waiting on the author and is actionable today.
    // They both used to render as `fail`.
    expect(ctx.getDecisionChipClass('Blocked')).not.toBe(
      ctx.getDecisionChipClass('Revise and resubmit')
    )
  })

  test('keeps Needs review and Approved with edits distinct', () => {
    // The other collapsed pair — both used to render as `warn`.
    expect(ctx.getDecisionChipClass('Needs review')).not.toBe(
      ctx.getDecisionChipClass('Approved with edits')
    )
  })

  test('maps each decision to its matching status token family', () => {
    // The class name is what selects the --status-* triplet in
    // css/dashboard.css, so the exact strings are load-bearing.
    expect(ctx.getDecisionChipClass('Approved')).toBe('decision-approved')
    expect(ctx.getDecisionChipClass('Approved with edits')).toBe('decision-edits')
    expect(ctx.getDecisionChipClass('Revise and resubmit')).toBe('decision-revise')
    expect(ctx.getDecisionChipClass('Blocked')).toBe('decision-blocked')
    expect(ctx.getDecisionChipClass('Needs review')).toBe('decision-pending')
  })

  test('falls back to the neutral chip for an unknown or missing decision', () => {
    // Saved state can carry a decision this build does not know about — an
    // imported backup, or one added later. Returning no class at all would
    // leave an unstyled chip.
    expect(ctx.getDecisionChipClass('Escalated')).toBe('decision-pending')
    expect(ctx.getDecisionChipClass('')).toBe('decision-pending')
    expect(ctx.getDecisionChipClass(undefined)).toBe('decision-pending')
  })
})

describe('getByPath', () => {
  const page = {
    sections: [{ paragraphs: ['first', { text: 'second' }], steps: [{ text: ['step text'] }] }],
  }

  test('resolves a nested array index to its value', () => {
    expect(getByPath(page, 'sections.0.paragraphs.0')).toBe('first')
  })

  test('resolves a path ending at an object item', () => {
    expect(getByPath(page, 'sections.0.paragraphs.1')).toEqual({ text: 'second' })
  })

  test('resolves through a step text array', () => {
    expect(getByPath(page, 'sections.0.steps.0.text.0')).toBe('step text')
  })

  test('returns undefined for a missing intermediate segment', () => {
    expect(getByPath(page, 'sections.9.paragraphs.0')).toBeUndefined()
  })

  test('returns undefined for an empty path', () => {
    expect(getByPath(page, '')).toBeUndefined()
  })
})

describe('setByPath', () => {
  test('writes a value at a resolvable path and reports success', () => {
    const page = { sections: [{ paragraphs: ['old'] }] }
    expect(setByPath(page, 'sections.0.paragraphs.0', 'new')).toBe(true)
    expect(page.sections[0].paragraphs[0]).toBe('new')
  })

  test('refuses an unresolvable path without creating intermediates', () => {
    const page = { sections: [] }
    expect(setByPath(page, 'sections.0.paragraphs.0', 'new')).toBe(false)
    expect(page.sections[0]).toBeUndefined()
  })

  test('returns false for an empty path', () => {
    const page = { sections: [] }
    expect(setByPath(page, '', 'new')).toBe(false)
  })
})

describe('getByPath / setByPath — prototype pollution protection', () => {
  test('getByPath returns undefined when any segment is __proto__', () => {
    const obj = { sections: [] }
    expect(ctx.getByPath(obj, '__proto__')).toBe(undefined)
    expect(ctx.getByPath(obj, '__proto__.polluted')).toBe(undefined)
  })

  test('getByPath returns undefined when any segment is prototype', () => {
    const obj = { sections: [] }
    expect(ctx.getByPath(obj, 'prototype')).toBe(undefined)
    expect(ctx.getByPath(obj, 'prototype.x')).toBe(undefined)
  })

  test('getByPath returns undefined when any segment is constructor', () => {
    const obj = { sections: [] }
    expect(ctx.getByPath(obj, 'constructor')).toBe(undefined)
    expect(ctx.getByPath(obj, 'constructor.prototype')).toBe(undefined)
  })

  test('setByPath returns false and writes nothing when path contains __proto__', () => {
    const obj = { sections: [] }
    const result = ctx.setByPath(obj, '__proto__.polluted', 'PWNED')
    expect(result).toBe(false)
    expect({}.polluted).toBe(undefined)
    expect(obj.polluted).toBe(undefined)
  })

  test('setByPath returns false and writes nothing when path contains prototype', () => {
    const obj = { sections: [] }
    const result = ctx.setByPath(obj, 'prototype.x', 'PWNED')
    expect(result).toBe(false)
    expect({}.x).toBe(undefined)
  })

  test('setByPath returns false and writes nothing when path contains constructor', () => {
    const obj = { sections: [] }
    const result = ctx.setByPath(obj, 'constructor.prototype.y', 'PWNED')
    expect(result).toBe(false)
    expect({}.y).toBe(undefined)
  })

  test('setByPath still works for normal, safe paths', () => {
    const obj = { sections: [{ title: 'Test' }] }
    const result = ctx.setByPath(obj, 'sections.0.title', 'Updated')
    expect(result).toBe(true)
    expect(obj.sections[0].title).toBe('Updated')
  })

  test('getByPath still works for normal, safe paths', () => {
    const obj = { sections: [{ paragraphs: ['text'] }] }
    expect(ctx.getByPath(obj, 'sections.0.paragraphs.0')).toBe('text')
  })
})

describe('REVIEW_RECORD_FIELDS', () => {
  test('includes section_edits', () => {
    expect(REVIEW_RECORD_FIELDS).toContain('section_edits')
  })
})

describe('buildReviewRecord', () => {
  test('defaults section_edits to an empty object', () => {
    const record = buildReviewRecord({ title: 'T', slug: 's' }, 'pestsTopic')
    expect(record.section_edits).toEqual({})
  })

  test('accepts a section_edits override', () => {
    const record = buildReviewRecord({ title: 'T', slug: 's' }, 'pestsTopic', {
      section_edits: { 'sections.0.heading': 'Edited' },
    })
    expect(record.section_edits).toEqual({ 'sections.0.heading': 'Edited' })
  })
})

// safeMarkdown had NO coverage at all before this block, because the unit-test
// environment never publishes window.marked/window.DOMPurify — those are set by
// js/core/third-party-globals.js, which only runs through js/main.js in the
// browser. So every previous call in a test took the "libraries missing" branch
// and returned escapeHtml(text), and the parse/sanitize path this function
// exists for was never executed here.
//
// That mattered once safeMarkdown started CACHING its marked configuration:
// the failure mode of a bad cache is the SECOND call silently losing the custom
// link renderer, which no amount of exercising the fallback branch can catch.
describe('safeMarkdown', () => {
  const originalMarked = window.marked
  const originalPurify = window.DOMPurify

  beforeAll(async () => {
    // The real libraries, not stubs — the DOMPurify allowlist below is the
    // thing under test, and a stub would prove nothing about it.
    const { marked } = await import('marked')
    const DOMPurify = (await import('dompurify')).default
    window.marked = marked
    window.DOMPurify = DOMPurify
  })

  afterAll(() => {
    // Restore, or these leak into sibling test files (see the file-level
    // convention: tests that stub globals must put them back).
    window.marked = originalMarked
    window.DOMPurify = originalPurify
  })

  test('renders an external link as a new-tab anchor with the external affordance', () => {
    const html = ctx.safeMarkdown('See [the guide](https://sf.gov/guide) for details.')
    expect(html).toContain('href="https://sf.gov/guide"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('class="inline-link"')
  })

  test('renders an internal page target as a render button, not a link', () => {
    const html = ctx.safeMarkdown('See [rodents](rodentsTopic).')
    expect(html).toContain('data-render-target="rodentsTopic"')
    expect(html).toContain('<button')
    expect(html).not.toContain('<a ')
  })

  // Emphasis cannot be asserted HERE, and the reason is the environment rather
  // than the code. Under happy-dom, DOMPurify strips <strong> and <em> even
  // though both are in ALLOWED_TAGS — measured 2026-08-20:
  //
  //   DOMPurify.sanitize('<strong>bold</strong>', { ALLOWED_TAGS: ['strong'] })
  //     -> 'bold'          (happy-dom, this test environment)
  //     -> '<strong>bold</strong>'   (Chromium, verified against the live deploy)
  //
  // <a>, <button> and <span> survive in both, which is why every other
  // assertion in this block is trustworthy. Asserting 'bold' here would pin
  // the artifact and go red the day happy-dom fixes it, so this stays a todo
  // and tests/e2e/ is where emphasis is actually covered.
  test.todo('renders bold and italic (blocked: happy-dom DOMPurify drops <strong>/<em>)')

  // The 18-line comment above the DOMPurify call explains why the allowlist is
  // explicit rather than DOMPurify's default: the default permits <img>, and
  // marked.parseInline emits one for ![alt](url), so a remote image written
  // into any paragraph would load off-origin from inside page copy — past
  // findExternalAssetUrls(), which inspects image.src only.
  test('strips an image, which the default DOMPurify allowlist would permit', () => {
    const html = ctx.safeMarkdown('![alt](https://evil.test/tracker.png)')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('evil.test')
  })

  test('strips a script tag', () => {
    const html = ctx.safeMarkdown('<script>alert(1)</script>hello')
    expect(html).not.toContain('<script')
    expect(html).toContain('hello')
  })

  // THE CACHE REGRESSION TEST. safeMarkdown configures marked's custom link
  // renderer once and reuses it. A cache that misidentifies "already
  // configured" leaves the second call running marked's DEFAULT link renderer,
  // which emits a plain <a href> with no target/rel and no data-render-target
  // — so an internal page link silently stops navigating. Identical output
  // across repeated calls is what proves the reuse is sound.
  test('produces identical output when called repeatedly', () => {
    const input = 'A [page](rodentsTopic) and an [external](https://sf.gov/x).'
    const first = ctx.safeMarkdown(input)
    const second = ctx.safeMarkdown(input)
    const third = ctx.safeMarkdown(input)
    expect(second).toBe(first)
    expect(third).toBe(first)
    expect(first).toContain('data-render-target="rodentsTopic"')
    expect(first).toContain('rel="noopener noreferrer"')
  })

  test('falls back to escaped plain text when the libraries are absent', () => {
    const saved = window.marked
    window.marked = undefined
    try {
      expect(ctx.safeMarkdown('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;')
    } finally {
      window.marked = saved
    }
  })

  test('returns an empty string for empty and nullish input', () => {
    expect(ctx.safeMarkdown('')).toBe('')
    expect(ctx.safeMarkdown(null)).toBe('')
    expect(ctx.safeMarkdown(undefined)).toBe('')
  })
})
