// Negative-path coverage for the page-data validation logic used by
// build_scripts/validate.js. Previously this logic only had an implicit
// "test" (does it happen to pass on today's real page content) — nothing
// proved it actually catches malformed data.
const { describe, test, expect } = require('bun:test')
const { dataSchema, pageSchema, PAGE_TYPES } = require('../build_scripts/schema')
const {
  findMissingOrderKeys,
  findBrokenCardTargets,
  findBrokenButtonTargets,
  findBrokenInlineLinks,
  isTopicPageFirst,
  findBannedTerms,
  findListFormatViolations,
  findUnsafeUrls,
  findExternalAssetUrls,
  findUnmappedSections,
  countUnverifiedClaims,
} = require('../build_scripts/data-checks')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')

describe('require() of build_scripts/data-checks.js', () => {
  // data-checks.js is CommonJS and `require()`s js/utils.js, which is an ES
  // module, so `findUnsafeUrls` and the renderer share one safeUrl rather than
  // two copies that could drift. Bun allows that only while js/utils.js is
  // SYNCHRONOUSLY evaluable: it rejects `require()` of an async module. A
  // top-level await that actually defers — `await import(...)`, an awaited
  // timer — makes js/utils.js async and breaks `bun run validate` outright,
  // with a TypeError naming neither validate nor the page data.
  //
  // Measured, because the boundary is narrower than "no top-level await":
  // `await Promise.resolve()` is already settled and still requires fine, while
  // `await new Promise((r) => setTimeout(r, 0))` and `await import('node:path')`
  // both throw. So this guards the deferring case, which is the one that bites.
  //
  // It runs in a SUBPROCESS on purpose, and two cheaper versions of this test
  // were written first and both passed against a deliberately broken
  // js/utils.js. In-process assertions cannot work here: any sibling test file
  // that ESM-imports js/utils.js leaves it evaluated and cached, so a later
  // `require()` of it succeeds no matter what. Only a fresh process reproduces
  // what `bun run validate` actually does.
  //
  // The fix, if this ever fails, is to remove the await — NOT to restructure
  // safeUrl. It is the XSS scheme guard, its own comment warns that failing in
  // one of its two execution contexts is worse than not existing, and on the browser side every
  // dual-export module in js/ is read off `window` rather than named-imported,
  // so extracting it would push js/page-render.js onto window indirection.
  test('loads in a fresh Bun process without an async-module error', () => {
    // process.execPath, not 'bun': this guards behaviour that CHANGED between
    // Bun versions, so resolving the runtime through PATH could test a
    // different one than the suite is running under and report on a version
    // nobody asked about. Not hypothetical — this machine carries two Bun
    // binaries (/root/.bun/bin/bun and /usr/local/bin/bun), in step today and
    // with nothing keeping them so after either is upgraded.
    const result = Bun.spawnSync(
      [process.execPath, '-e', "require('./build_scripts/data-checks.js')"],
      { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' }
    )
    if (result.exitCode !== 0) {
      const stderr = result.stderr.toString().trim()
      // Always carry stderr into the failure. A bare exit-code assertion
      // reproduces the very problem this test exists to prevent: `bun run
      // validate` failing with nothing that names the cause. The async-module
      // hint is added when it applies, rather than being the only path that
      // surfaces anything.
      const hint = stderr.includes('async module')
        ? '\n\nLikely cause: a DEFERRING top-level await was added to js/utils.js or something it imports. Remove it — do not restructure safeUrl (see the comment above this test).'
        : ''
      throw new Error(
        `require('build_scripts/data-checks.js') failed in a fresh ${process.execPath} ` +
          `(Bun ${Bun.version}, exit ${result.exitCode}).\n--- stderr ---\n${stderr}${hint}`
      )
    }
    expect(result.exitCode).toBe(0)
  })
})

function validPage(overrides = {}) {
  return {
    slug: 'pests-and-housing-problems/report-rats-or-mice',
    type: 'Transaction',
    title: 'Report rats or mice',
    summary: 'Tell us about a rodent problem at your home or business.',
    audience: ['Tenants', 'Property owners'],
    reading: '8th grade',
    sections: [],
    ...overrides,
  }
}

function validData(pageOverrides = {}) {
  return {
    pages: { pestsTopic: validPage(pageOverrides) },
    order: [['pestsTopic', 'Pests and housing problems']],
  }
}

describe('page type union', () => {
  // `type` selects the Karl panel inventory in js/karl-blocks.js, so a typo'd
  // value would export an EMPTY transcript rather than erroring — an outcome
  // that reads like a page with no content instead of like a bug. That is why
  // the field is a closed union rather than the open z.string() it used to be.
  test('accepts every type the corpus declares', () => {
    for (const type of PAGE_TYPES) {
      expect(pageSchema.safeParse(validPage({ type })).success).toBe(true)
    }
  })

  test('rejects a type that is not a Karl content type', () => {
    expect(pageSchema.safeParse(validPage({ type: 'Transactoin' })).success).toBe(false)
  })

  test('names exactly the eight types in use', () => {
    expect(PAGE_TYPES).toEqual([
      'Transaction',
      'Information',
      'Resource Collection',
      'Campaign',
      'Topic',
      'Agency',
      'About us',
      'Report',
    ])
  })
})

describe('dataSchema', () => {
  test('accepts a minimal valid page', () => {
    const result = dataSchema.safeParse(validData())
    expect(result.success).toBe(true)
  })

  test('rejects a page missing a required field', () => {
    const page = validPage()
    delete page.title
    const data = { pages: { pestsTopic: page }, order: [['pestsTopic', 'Pests']] }
    expect(dataSchema.safeParse(data).success).toBe(false)
  })

  test('rejects an empty-string required field', () => {
    const data = validData({ title: '' })
    expect(dataSchema.safeParse(data).success).toBe(false)
  })

  test('rejects an empty audience array', () => {
    const data = validData({ audience: [] })
    expect(dataSchema.safeParse(data).success).toBe(false)
  })

  test('rejects a section missing its required karl field', () => {
    const data = validData({
      sections: [{ heading: 'Intro', paragraphs: ['hello'] }],
    })
    expect(dataSchema.safeParse(data).success).toBe(false)
  })

  test('accepts a fully populated section with cards and steps', () => {
    const data = validData({
      sections: [
        {
          heading: 'Intro',
          karl: 'Body section',
          paragraphs: ['hello'],
          cards: [{ title: 'Card', text: 'Text', target: 'pestsTopic' }],
          steps: [{ title: 'Step', button: 'Go' }],
        },
      ],
    })
    expect(dataSchema.safeParse(data).success).toBe(true)
  })

  test('rejects an order entry that is not a [key, label] tuple', () => {
    const data = validData()
    data.order = [['pestsTopic']]
    expect(dataSchema.safeParse(data).success).toBe(false)
  })

  test('accepts a page with partnerAgencies entries', () => {
    const data = validData({
      partnerAgencies: [
        { title: '311 Customer Service Center', url: 'https://www.sf.gov/departments--311' },
      ],
    })
    expect(dataSchema.safeParse(data).success).toBe(true)
  })

  test('rejects a partnerAgencies entry missing its required title', () => {
    const data = validData({
      partnerAgencies: [{ url: 'https://www.sf.gov/departments--311' }],
    })
    expect(dataSchema.safeParse(data).success).toBe(false)
  })

  test('accepts a supporting section marked flat', () => {
    const data = validData({
      sections: [
        {
          heading: 'Other ways to report',
          karl: 'Supporting info',
          component: 'supporting',
          flat: true,
        },
      ],
    })
    expect(dataSchema.safeParse(data).success).toBe(true)
  })

  test('rejects a non-boolean flat value on a section', () => {
    const data = validData({
      sections: [
        {
          heading: 'Other ways to report',
          karl: 'Supporting info',
          component: 'supporting',
          flat: 'yes',
        },
      ],
    })
    expect(dataSchema.safeParse(data).success).toBe(false)
  })

  test('accepts a top-facts section with labeled facts', () => {
    const data = validData({
      sections: [
        {
          heading: 'Questions before you apply',
          karl: 'Top facts',
          component: 'top-facts',
          facts: [{ label: 'Contact', text: 'Call 311.' }],
        },
      ],
    })
    expect(dataSchema.safeParse(data).success).toBe(true)
  })

  test('rejects a fact missing its required label', () => {
    const data = validData({
      sections: [
        {
          heading: 'Questions before you apply',
          karl: 'Top facts',
          component: 'top-facts',
          facts: [{ text: 'Call 311.' }],
        },
      ],
    })
    expect(dataSchema.safeParse(data).success).toBe(false)
  })

  test('accepts a page with a Contact us social media entry', () => {
    const data = validData({
      contact: { social: [{ platform: 'Facebook', url: 'https://www.facebook.com/shopdinesf' }] },
    })
    expect(dataSchema.safeParse(data).success).toBe(true)
  })

  test('rejects a social media entry missing its required url', () => {
    const data = validData({
      contact: { social: [{ platform: 'Facebook' }] },
    })
    expect(dataSchema.safeParse(data).success).toBe(false)
  })
})

describe('isTopicPageFirst', () => {
  test('true when pestsTopic leads the order array', () => {
    expect(
      isTopicPageFirst([
        ['pestsTopic', 'x'],
        ['other', 'y'],
      ])
    ).toBe(true)
  })

  test('false when another page leads', () => {
    expect(
      isTopicPageFirst([
        ['other', 'y'],
        ['pestsTopic', 'x'],
      ])
    ).toBe(false)
  })

  test('false for an empty order array', () => {
    expect(isTopicPageFirst([])).toBe(false)
  })
})

describe('findMissingOrderKeys', () => {
  test('empty when every order key exists in pages', () => {
    const pages = { a: {}, b: {} }
    const order = [
      ['a', 'A'],
      ['b', 'B'],
    ]
    expect(findMissingOrderKeys(pages, order)).toEqual([])
  })

  test('reports order keys with no matching page', () => {
    const pages = { a: {} }
    const order = [
      ['a', 'A'],
      ['ghost', 'Ghost'],
    ]
    expect(findMissingOrderKeys(pages, order)).toEqual(['ghost'])
  })
})

describe('findBrokenCardTargets', () => {
  test('empty when every card target exists', () => {
    const pages = {
      a: { sections: [{ cards: [{ target: 'b' }] }] },
      b: {},
    }
    expect(findBrokenCardTargets(pages)).toEqual([])
  })

  test('reports a card target with no matching page', () => {
    const pages = {
      a: { sections: [{ cards: [{ target: 'ghost' }] }] },
    }
    expect(findBrokenCardTargets(pages)).toEqual([{ pageKey: 'a', target: 'ghost' }])
  })

  test('ignores cards with no target (inert/decorative cards)', () => {
    const pages = { a: { sections: [{ cards: [{ title: 'No link' }] }] } }
    expect(findBrokenCardTargets(pages)).toEqual([])
  })
})

describe('findBrokenButtonTargets', () => {
  test('empty when every section/step buttonTarget exists', () => {
    const pages = {
      a: { sections: [{ buttonTarget: 'b', steps: [{ buttonTarget: 'b' }] }] },
      b: {},
    }
    expect(findBrokenButtonTargets(pages)).toEqual([])
  })

  test('reports a section buttonTarget with no matching page', () => {
    const pages = { a: { sections: [{ buttonTarget: 'ghost' }] } }
    expect(findBrokenButtonTargets(pages)).toEqual([{ pageKey: 'a', target: 'ghost' }])
  })

  test('reports a step buttonTarget with no matching page', () => {
    const pages = { a: { sections: [{ steps: [{ buttonTarget: 'ghost' }] }] } }
    expect(findBrokenButtonTargets(pages)).toEqual([{ pageKey: 'a', target: 'ghost' }])
  })

  test('ignores sections/steps with no buttonTarget', () => {
    const pages = { a: { sections: [{ button: 'Go', steps: [{ button: 'Go' }] }] } }
    expect(findBrokenButtonTargets(pages)).toEqual([])
  })
})

describe('findBrokenInlineLinks', () => {
  test('empty when inline links point at existing pages, URLs, or the inert sentinel', () => {
    const pages = {
      a: {
        sections: [
          {
            paragraphs: ['See [page b](b) or [the CDC](https://www.cdc.gov/rodents/).'],
            bullets: ['Inert placeholder: [DBI](#)'],
          },
        ],
      },
      b: {},
    }
    expect(findBrokenInlineLinks(pages)).toEqual([])
  })

  test('reports a paragraph link to a missing page key', () => {
    const pages = { a: { sections: [{ paragraphs: ['Go to [ghost page](ghost).'] }] } }
    expect(findBrokenInlineLinks(pages)).toEqual([{ pageKey: 'a', target: 'ghost' }])
  })

  // The three cases below pin this function at the boundary it shares with
  // js/inline-link-target.js. The predicate has its own exhaustive unit file;
  // what these add is coverage of the CALLER, because extracting the rule
  // changed exactly one thing here — targets are now trimmed before testing —
  // and a corpus that happens to carry no padded target cannot show that.
  // `bun run validate` passing is evidence about the 29 real pages, not about
  // the rule, and this function also runs inside the AI output validator,
  // where the input is a model-generated draft rather than reviewed copy.
  test('does not report a URL target padded with whitespace', () => {
    // Was reported broken before the rule was extracted: the capture in the
    // markdown regex is `([^)]+)`, so the spaces arrive as part of the target
    // and the old `/^https?:\/\//` test failed on the leading one. The
    // question this check asks is about the target, not whitespace hygiene.
    const pages = { a: { sections: [{ paragraphs: ['See [311]( https://sf.gov/311 ).'] }] } }
    expect(findBrokenInlineLinks(pages)).toEqual([])
  })

  test('does not report a page key padded with whitespace', () => {
    const pages = { a: { sections: [{ paragraphs: ['See [page b]( b ).'] }] }, b: {} }
    expect(findBrokenInlineLinks(pages)).toEqual([])
  })

  test('still reports an unsafe scheme, which is neither a key nor http(s)', () => {
    // The target is captured as `javascript:alert(1` rather than the full
    // string because `([^)]+)` stops at the first `)`. Pinned as-is: it is
    // pre-existing behaviour of the capture, unchanged by the extraction, and
    // asserting the tidier string would make this test fail for a reason that
    // has nothing to do with the rule under test.
    const pages = { a: { sections: [{ paragraphs: ['[x](javascript:alert(1))'] }] } }
    expect(findBrokenInlineLinks(pages)).toEqual([{ pageKey: 'a', target: 'javascript:alert(1' }])
  })

  test('reports broken links inside bullets, step text, and step bullets', () => {
    const pages = {
      a: {
        sections: [
          {
            bullets: ['[one](ghost1)'],
            steps: [{ text: ['[two](ghost2)'], bullets: ['[three](ghost3)'] }],
          },
        ],
      },
    }
    expect(findBrokenInlineLinks(pages)).toEqual([
      { pageKey: 'a', target: 'ghost1' },
      { pageKey: 'a', target: 'ghost2' },
      { pageKey: 'a', target: 'ghost3' },
    ])
  })

  test('checks unverified-item objects the same as plain strings', () => {
    const pages = {
      a: {
        sections: [{ bullets: [{ text: '[gone](ghost)', unverified: true }] }],
      },
    }
    expect(findBrokenInlineLinks(pages)).toEqual([{ pageKey: 'a', target: 'ghost' }])
  })

  test('reports broken links inside table cells', () => {
    const pages = {
      a: {
        sections: [
          {
            table: [
              ['[one](ghost1)', 'normal text'],
              ['normal text', '[two](ghost2)'],
            ],
          },
        ],
      },
    }
    expect(findBrokenInlineLinks(pages)).toEqual([
      { pageKey: 'a', target: 'ghost1' },
      { pageKey: 'a', target: 'ghost2' },
    ])
  })

  test('reports broken links inside section and step callouts', () => {
    const pages = {
      a: {
        sections: [
          {
            callout: { text: '[one](ghost1)' },
            steps: [{ callout: { text: '[two](ghost2)' } }],
          },
        ],
      },
    }
    expect(findBrokenInlineLinks(pages)).toEqual([
      { pageKey: 'a', target: 'ghost1' },
      { pageKey: 'a', target: 'ghost2' },
    ])
  })
})

describe('findBannedTerms', () => {
  const bannedTerms = ['plumbing', 'dbi', 'sewer']

  test('empty when no banned terms are present', () => {
    expect(findBannedTerms({ title: 'Report rats or mice' }, bannedTerms)).toEqual([])
  })

  test('finds a banned term regardless of case or nesting depth', () => {
    const page = { sections: [{ paragraphs: ['Contact DBI about this.'] }] }
    expect(findBannedTerms(page, bannedTerms)).toEqual(['dbi'])
  })

  test('finds multiple banned terms', () => {
    const page = { title: 'plumbing and sewer issues' }
    expect(findBannedTerms(page, bannedTerms)).toEqual(['plumbing', 'sewer'])
  })

  test('ignores image src, so base64 bytes cannot trip a term', () => {
    // Not hypothetical: the real Agency spotlight photo, inlined as a base64
    // data: URI, happens to contain the sequence "dbi" and failed validation
    // on a page whose copy says nothing about DBI. Base64 is an arbitrary run
    // of letters and an image source is machine data, not prose — this check
    // asks an editorial question and must only read editorial content.
    const page = {
      title: 'Healthy Housing and Vector Control',
      spotlight: { image: { src: 'data:image/webp;base64,UklGRxxdbiQUJEUA' } },
    }

    expect(findBannedTerms(page, bannedTerms)).toEqual([])
  })

  test('still finds a banned term in copy on a page that also has an image', () => {
    // The exclusion must be narrow: stripping src must not blind the check to
    // the prose sitting next to it.
    const page = {
      spotlight: { image: { src: 'data:image/webp;base64,AAAA', alt: 'A photo' } },
      sections: [{ paragraphs: ['Contact DBI about this.'] }],
    }

    expect(findBannedTerms(page, bannedTerms)).toEqual(['dbi'])
  })
})

describe('findListFormatViolations', () => {
  test('empty when lists of 3+ use bullets instead of paragraphs or step text', () => {
    const pages = {
      a: {
        sections: [
          { paragraphs: ['One', 'Two'], bullets: ['A', 'B', 'C'] },
          { steps: [{ text: ['One', 'Two'], bullets: ['A', 'B', 'C'] }] },
        ],
      },
    }
    expect(findListFormatViolations(pages)).toEqual([])
  })

  test('reports section paragraphs with 3 or more items', () => {
    const pages = { a: { sections: [{ paragraphs: ['One', 'Two', 'Three'] }] } }
    expect(findListFormatViolations(pages)).toEqual([
      { pageKey: 'a', path: 'sections[0].paragraphs', count: 3 },
    ])
  })

  test('reports step text with 3 or more items', () => {
    const pages = { a: { sections: [{ steps: [{ text: ['One', 'Two', 'Three'] }] }] } }
    expect(findListFormatViolations(pages)).toEqual([
      { pageKey: 'a', path: 'sections[0].steps[0].text', count: 3 },
    ])
  })
})

describe('content-confidence fields', () => {
  test('accepts a card with unverified and unverifiedReason', () => {
    const data = validData({
      sections: [
        {
          heading: 'Intro',
          karl: 'Body section',
          cards: [
            {
              title: 'Card',
              text: 'Text',
              unverified: true,
              unverifiedReason: 'SME placeholder',
            },
          ],
        },
      ],
    })
    expect(dataSchema.safeParse(data).success).toBe(true)
  })

  test('accepts a mix of plain strings and unverified objects in bullets', () => {
    const data = validData({
      sections: [
        {
          heading: 'Intro',
          karl: 'Body section',
          bullets: [
            'Plain bullet',
            { text: 'Flagged bullet', unverified: true, unverifiedReason: 'Confirm with SME' },
          ],
        },
      ],
    })
    expect(dataSchema.safeParse(data).success).toBe(true)
  })

  test('accepts a mix of plain strings and unverified objects in paragraphs', () => {
    const data = validData({
      sections: [
        {
          heading: 'Intro',
          karl: 'Body section',
          paragraphs: ['Plain paragraph', { text: 'Flagged paragraph', unverified: true }],
        },
      ],
    })
    expect(dataSchema.safeParse(data).success).toBe(true)
  })

  test('accepts unverified objects in step text and bullets', () => {
    const data = validData({
      sections: [
        {
          heading: 'Intro',
          karl: 'Body section',
          steps: [
            {
              title: 'Step',
              text: [{ text: 'Flagged step text', unverified: true }],
              bullets: [{ text: 'Flagged step bullet', unverified: true }],
            },
          ],
        },
      ],
    })
    expect(dataSchema.safeParse(data).success).toBe(true)
  })

  test('rejects an unverified item with empty text', () => {
    const data = validData({
      sections: [
        {
          heading: 'Intro',
          karl: 'Body section',
          bullets: [{ text: '', unverified: true }],
        },
      ],
    })
    expect(dataSchema.safeParse(data).success).toBe(false)
  })
})

describe('countUnverifiedClaims', () => {
  test('zero when nothing is flagged', () => {
    const pages = { a: { sections: [{ bullets: ['Plain'], paragraphs: ['Plain'] }] } }
    expect(countUnverifiedClaims(pages)).toBe(0)
  })

  test('counts flagged bullets, paragraphs, step text/bullets, and cards', () => {
    const pages = {
      a: {
        sections: [
          {
            bullets: ['Plain', { text: 'Flagged', unverified: true }],
            paragraphs: [{ text: 'Flagged', unverified: true }],
            cards: [{ title: 'Card', unverified: true }, { title: 'Card 2' }],
            steps: [
              {
                text: [{ text: 'Flagged', unverified: true }],
                bullets: [{ text: 'Flagged', unverified: true }],
              },
            ],
          },
        ],
      },
    }
    expect(countUnverifiedClaims(pages)).toBe(5)
  })

  test('does not count an object item with unverified: false', () => {
    const pages = { a: { sections: [{ bullets: [{ text: 'Not flagged', unverified: false }] }] } }
    expect(countUnverifiedClaims(pages)).toBe(0)
  })
})

describe('findExternalAssetUrls', () => {
  test('flags a hotlinked spotlight image', () => {
    // The exact regression this check exists for: one image on one page,
    // loaded from a third party, quietly making the whole tool need a network.
    const pages = {
      a: { spotlight: { image: { src: 'https://images.unsplash.com/photo-1560518883' } } },
    }

    expect(findExternalAssetUrls(pages)).toEqual([
      {
        pageKey: 'a',
        path: 'spotlight.image.src',
        url: 'https://images.unsplash.com/photo-1560518883',
      },
    ])
  })

  test('flags a hotlinked section image', () => {
    const pages = {
      a: { sections: [{ heading: 'H', karl: 'k', image: { src: 'http://example.com/a.jpg' } }] },
    }

    expect(findExternalAssetUrls(pages)).toEqual([
      { pageKey: 'a', path: 'sections[0].image.src', url: 'http://example.com/a.jpg' },
    ])
  })

  test('flags a protocol-relative image src', () => {
    // Reads as a path but leaves the origin, so it is an off-site load.
    const pages = { a: { spotlight: { image: { src: '//cdn.example.com/a.jpg' } } } }

    expect(findExternalAssetUrls(pages)).toEqual([
      { pageKey: 'a', path: 'spotlight.image.src', url: '//cdn.example.com/a.jpg' },
    ])
  })

  test('flags protocol-relative image srcs disguised with backslashes', () => {
    // Browsers treat backslashes as forward slashes in the authority position,
    // so every one of these fetches from cdn.example.com. Confirmed in
    // Chromium against a live <img>, not inferred: matching the raw string on
    // /^(https?:)?\/\// let all four through while the offline guarantee they
    // break stayed silently broken.
    const spellings = [
      '\\\\cdn.example.com/a.jpg',
      '\\/cdn.example.com/a.jpg',
      '/\\cdn.example.com/a.jpg',
      'https:\t//cdn.example.com/a.jpg',
    ]

    for (const src of spellings) {
      expect(findExternalAssetUrls({ a: { spotlight: { image: { src } } } })).toEqual([
        { pageKey: 'a', path: 'spotlight.image.src', url: src },
      ])
    }
  })

  test('flags a whitespace-padded absolute URL', () => {
    // Padding must not evade the check. Unlike the backslash spellings above
    // this one was never a bypass — trim() alone already caught it — so it
    // documents the behaviour rather than guarding a regression.
    const src = '   https://images.unsplash.com/photo-1560518883   '

    expect(findExternalAssetUrls({ a: { spotlight: { image: { src } } } })).toEqual([
      { pageKey: 'a', path: 'spotlight.image.src', url: src },
    ])
  })

  test('accepts a data: URI, which is the whole point of the placeholder', () => {
    // Deliberately the opposite of findUnsafeUrls' rule: there data: is
    // rejected because the value is navigated to; here it is rendered as
    // bytes, and being self-contained is exactly what is wanted.
    const pages = {
      a: { spotlight: { image: { src: 'data:image/svg+xml,%3Csvg/%3E' } } },
    }

    expect(findExternalAssetUrls(pages)).toEqual([])
  })

  test('accepts relative and root-relative image paths', () => {
    const pages = {
      a: {
        spotlight: { image: { src: '/images/a.svg' } },
        sections: [{ heading: 'H', karl: 'k', image: { src: 'images/b.svg' } }],
      },
    }

    expect(findExternalAssetUrls(pages)).toEqual([])
  })

  test('ignores a page with no images at all', () => {
    expect(findExternalAssetUrls({ a: { sections: [{ heading: 'H', karl: 'k' }] } })).toEqual([])
  })
})

describe('findUnsafeUrls', () => {
  test('flags a javascript: card url', () => {
    const pages = {
      a: {
        sections: [
          { heading: 'H', karl: 'k', cards: [{ title: 'X', url: 'javascript:alert(1)' }] },
        ],
      },
    }
    expect(findUnsafeUrls(pages)).toEqual([
      { pageKey: 'a', path: 'sections[0].cards[0].url', url: 'javascript:alert(1)' },
    ])
  })

  test('flags a data: buttonUrl on a section', () => {
    const pages = { a: { sections: [{ heading: 'H', karl: 'k', buttonUrl: 'data:text/html,x' }] } }
    expect(findUnsafeUrls(pages)).toEqual([
      { pageKey: 'a', path: 'sections[0].buttonUrl', url: 'data:text/html,x' },
    ])
  })

  test('flags an unsafe step buttonUrl and printVersionUrl', () => {
    const pages = {
      a: {
        printVersionUrl: 'javascript:1',
        sections: [{ heading: 'H', karl: 'k', steps: [{ title: 'S', buttonUrl: 'vbscript:1' }] }],
      },
    }
    const paths = findUnsafeUrls(pages).map((entry) => entry.path)
    expect(paths).toContain('printVersionUrl')
    expect(paths).toContain('sections[0].steps[0].buttonUrl')
  })

  test('accepts https, mailto, and root-relative urls', () => {
    const pages = {
      a: {
        printVersionUrl: 'https://sf.gov/x.pdf',
        sections: [
          {
            heading: 'H',
            karl: 'k',
            buttonUrl: '/forms/mosquito-workshop-request/',
            cards: [{ title: 'X', url: 'mailto:hhvc@sfdph.org' }],
          },
        ],
      },
    }
    expect(findUnsafeUrls(pages)).toEqual([])
  })

  test('flags a protocol-relative url disguised with backslashes', () => {
    const pages = {
      a: {
        sections: [{ heading: 'H', karl: 'k', cards: [{ title: 'X', url: '\\\\evil.example' }] }],
      },
    }
    expect(findUnsafeUrls(pages).map((entry) => entry.path)).toEqual(['sections[0].cards[0].url'])
  })

  // safeUrl() trims before returning, so comparing its output against the raw
  // input reported any padded URL as an unsafe scheme. Whitespace hygiene is
  // not what this check is for.
  test('does not flag a safe url merely for surrounding whitespace', () => {
    const pages = {
      a: {
        sections: [
          { heading: 'H', karl: 'k', cards: [{ title: 'X', url: '  https://sf.gov/x  ' }] },
        ],
      },
    }
    expect(findUnsafeUrls(pages)).toEqual([])
  })

  test('returns nothing for pages with no url fields', () => {
    expect(findUnsafeUrls({ a: { sections: [{ heading: 'H', karl: 'k' }] } })).toEqual([])
  })
})

describe('findUnmappedSections', () => {
  /** One page shaped like a Transaction with a section-level button (U1). */
  function pageWithSectionButton(overrides = {}) {
    return {
      slug: 's',
      type: 'Transaction',
      title: 'T',
      summary: 'S',
      audience: ['Tenants'],
      reading: 'Grade 6',
      sections: [
        {
          heading: 'Look it up',
          karl: 'Custom section.',
          paragraphs: ['Prose.'],
          button: 'Search records',
          buttonUrl: 'https://sf.gov/search',
          ...overrides,
        },
      ],
    }
  }

  const U1_ONLY = [
    {
      id: 'U1',
      shape: 'section-button-outside-step',
      docLine: 828,
      reason: 'Section-level buttons outside a step have no documented Karl slot.',
    },
  ]

  test('a known unmapped shape passes', () => {
    expect(findUnmappedSections({ p: pageWithSectionButton() }, U1_ONLY)).toEqual([])
  })

  test('an unmapped shape with no rule fails', () => {
    // The ratchet, and the whole difference between this and the report
    // `bun run audit-cards` is: a new class of unmappable content stops the
    // build rather than being noticed by whoever happens to read the output.
    const findings = findUnmappedSections({ p: pageWithSectionButton() }, [])
    expect(findings.map((finding) => finding.shape)).toContain('section-button-outside-step')
    expect(findings[0].pageKey).toBe('p')
  })

  test('exemption is by SHAPE, never by page key or index', () => {
    // A path allowlist would let a NEWLY AUTHORED section inherit an old
    // exemption just by landing at the same index — exactly the case this
    // check exists to catch. Two different pages carrying the same shape are
    // both exempt, and neither is exempt because of where it sits.
    const pages = {
      a: pageWithSectionButton({ button: 'One' }),
      b: pageWithSectionButton({ button: 'Two' }),
    }
    expect(findUnmappedSections(pages, U1_ONLY)).toEqual([])
  })

  test('a different shape at the same path is still reported', () => {
    // The other half of the same property: the exemption travels with the
    // shape, so a section at index 0 carrying something else entirely gains
    // nothing from U1's rule.
    const pages = {
      a: {
        slug: 's',
        type: 'Transaction',
        title: 'T',
        summary: 'S',
        audience: ['Tenants'],
        reading: 'Grade 6',
        sections: [{ heading: 'Fees', karl: 'Custom section.', table: [['A', 'B']] }],
      },
    }
    expect(findUnmappedSections(pages, U1_ONLY).map((finding) => finding.path)).toEqual([
      'sections.0.table',
    ])
  })

  test('no rules at all still returns findings rather than throwing', () => {
    expect(() => findUnmappedSections({ p: pageWithSectionButton() }, undefined)).not.toThrow()
  })

  test('the real corpus is fully covered', () => {
    // The ratchet's resting state, and the assertion `bun run validate`
    // enforces. A failure here names content authored with no Karl
    // destination: decide the destination, or open a register entry and add
    // its shape rule. Do not widen an existing rule to make it green.
    const { loadPageData } = require('../build_scripts/load-pages.js')
    const { UNRESOLVED } = require('../js/karl-blocks.js')
    expect(findUnmappedSections(loadPageData().pages, UNRESOLVED)).toEqual([])
  })
})

describe('transcript over-coverage', () => {
  // The mirror of findUnmappedSections. That check catches content reaching NO
  // panel; this one catches content reaching TWO, which no existing gate could
  // see — `consumed` is a Set, so a double emission is invisible to the
  // unmapped sweep, and the unit suite's entry lookup is a `.find()` that
  // returns the first match and is structurally blind to a second.
  //
  // It cost a real defect before it existed: Information's `related` panel
  // matches both `component: 'related'` and any `title-only` card section, a
  // Related panel is usually both, and the transcript told an editor to add the
  // same page references twice.
  //
  // Two entries for one section are legitimate ONLY when they take different
  // halves of it — Resource Collection's `introductory_text` takes the prose
  // and `body` takes the links — so the assertion is on the scope, not on the
  // count.
  test('no section is emitted twice into the same scope', () => {
    const { loadPageData } = require('../build_scripts/load-pages.js')
    const { buildTranscript } = require('../js/karl-transcript.js')
    const pages = loadPageData().pages

    const collisions = []
    for (const [pageKey, page] of Object.entries(pages)) {
      const scopesBySection = new Map()
      for (const entry of buildTranscript(page, null, pages).entries) {
        if (entry.sectionIndex === undefined) continue
        const seen = scopesBySection.get(entry.sectionIndex) || []
        if (seen.includes(entry.scope)) {
          collisions.push(`${pageKey} sections.${entry.sectionIndex} scope=${entry.scope}`)
        }
        seen.push(entry.scope)
        scopesBySection.set(entry.sectionIndex, seen)
      }
    }
    expect(collisions).toEqual([])
  })
})
