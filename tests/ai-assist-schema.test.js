// Guard against build_scripts/ai/schemas.js drifting from build_scripts/schema.js.
//
// The AI output schema is hand-authored: structured outputs support only a
// subset of JSON Schema, so it cannot be generated from the Zod schema without
// a converter dependency. Hand-authored means it can silently fall out of step
// — someone adds a section component to the Zod enum, forgets the JSON Schema,
// and the model can no longer produce that component with no error anywhere.
//
// The contract these tests enforce: anything the AI schema permits must also
// satisfy the Zod schema that `bun run validate` and CI apply.
const { describe, test, expect } = require('bun:test')
const { pageSchema, sectionSchema } = require('../build_scripts/schema')
const {
  PAGE_OUTPUT_SCHEMA,
  COMPLIANCE_AUDIT_OUTPUT_SCHEMA,
  PAGE_TYPES,
  SECTION_COMPONENTS,
  generateRequestSchema,
  measureDepth,
  MAX_PAGE_DEPTH,
} = require('../build_scripts/ai/schemas')
const { validateGeneratedPage } = require('../build_scripts/ai/validate-output')

/** Walk every object node in a JSON Schema. */
function eachObjectNode(node, visit, path = 'root') {
  if (!node || typeof node !== 'object') return
  if (node.type === 'object') visit(node, path)
  for (const [key, value] of Object.entries(node.properties || {})) {
    eachObjectNode(value, visit, `${path}.${key}`)
  }
  if (node.items) eachObjectNode(node.items, visit, `${path}[]`)
}

describe('AI output schema shape', () => {
  test('every object node forbids additional properties', () => {
    // Structured outputs require this, and it is also what stops the model
    // inventing fields the page renderer would silently ignore.
    eachObjectNode(PAGE_OUTPUT_SCHEMA, (node, path) => {
      expect(`${path}: ${node.additionalProperties}`).toBe(`${path}: false`)
    })
  })

  test('every object node declares a required array', () => {
    eachObjectNode(PAGE_OUTPUT_SCHEMA, (node, path) => {
      expect(`${path}: ${Array.isArray(node.required)}`).toBe(`${path}: true`)
    })
  })

  test('every required property is actually defined on its node', () => {
    eachObjectNode(PAGE_OUTPUT_SCHEMA, (node, path) => {
      for (const key of node.required || []) {
        expect(`${path}.${key} defined: ${Boolean(node.properties[key])}`).toBe(
          `${path}.${key} defined: true`
        )
      }
    })
  })

  test('uses no JSON Schema keywords structured outputs do not support', () => {
    // minLength/maxLength/minimum/maximum/pattern are silently unsupported.
    // Relying on them would look like validation while enforcing nothing.
    const unsupported = ['minLength', 'maxLength', 'minimum', 'maximum', 'minItems', 'maxItems']
    const serialized = JSON.stringify(PAGE_OUTPUT_SCHEMA)
    for (const keyword of unsupported) {
      expect(`${keyword} present: ${serialized.includes(`"${keyword}"`)}`).toBe(
        `${keyword} present: false`
      )
    }
  })

  test('requires a karl note on every section, as the Zod schema does', () => {
    expect(PAGE_OUTPUT_SCHEMA.properties.sections.items.required).toContain('karl')
  })
})

describe('AI output schema agrees with the Zod page schema', () => {
  test('section components match the Zod enum exactly', () => {
    // The drift this file exists to catch: add a component to one, not the other.
    // `.options` is ZodEnum's public accessor; `_def.values` is the same list
    // reached through internals Zod makes no stability promise about.
    const zodComponents = sectionSchema.shape.component.unwrap().options
    expect([...SECTION_COMPONENTS].sort()).toEqual([...zodComponents].sort())
    expect(PAGE_OUTPUT_SCHEMA.properties.sections.items.properties.component.enum).toEqual(
      SECTION_COMPONENTS
    )
  })

  test('every page type the AI may emit is accepted by the Zod schema', () => {
    for (const type of PAGE_TYPES) {
      const result = pageSchema.safeParse({
        slug: 'sf.gov/test',
        type,
        title: 'A title',
        summary: 'A summary.',
        audience: ['Someone'],
        reading: 'Grade 6',
        sections: [],
      })
      expect(`${type}: ${result.success}`).toBe(`${type}: true`)
    }
  })

  test('the AI schema requires everything the Zod schema requires', () => {
    // Any field Zod demands but the AI schema treats as optional would produce
    // drafts that fail validation on a technicality the model was never told
    // about. `sections` is required here but optional in Zod, which is fine —
    // stricter is safe, looser is not.
    const zodRequired = Object.entries(pageSchema.shape)
      .filter(([, field]) => !field.isOptional())
      .map(([key]) => key)
    for (const key of zodRequired) {
      expect(`${key} required: ${PAGE_OUTPUT_SCHEMA.required.includes(key)}`).toBe(
        `${key} required: true`
      )
    }
  })

  test('a page using every field the AI schema allows passes real validation', () => {
    // The end-to-end contract: maximal AI-permitted output survives the Zod
    // schema, the business invariants, and the plain-language mandates.
    const maximal = {
      slug: 'sf.gov/report-a-pest-problem',
      type: 'Transaction',
      title: 'Report a pest problem',
      summary: 'Tell us about pests in your home. We will send an inspector.',
      audience: ['A tenant who sees pests at home'],
      reading: 'Grade 5-6',
      seoTitle: 'Report a pest problem | SF.gov',
      metaDescription: 'Report pests in your home and learn what happens next.',
      primaryCta: 'Report through 311',
      editorNote: 'Draft for review.',
      sections: [
        {
          heading: 'What to do',
          component: 'what-to-do',
          kind: 'body',
          karl: 'what_to_do StreamField. One Section block per step.',
          steps: [
            {
              title: 'Start your report',
              text: ['Use 311 to tell us about the problem.'],
              bullets: ['Give the address.', 'Say what you saw.'],
              button: 'Report through 311',
              buttonUrl: 'https://www.sf311.org/',
              karl: 'what_to_do -> Section. Title: "Start your report".',
              callout: {
                title: 'Your report is confidential',
                text: 'We will not share your name with the property owner.',
                variant: 'info',
                karl: 'Callout block inside the Section specifics.',
              },
            },
          ],
        },
        {
          heading: 'Related pages',
          component: 'related',
          kind: 'placement',
          karl: 'Related section. One link entry per card.',
          cards: [
            {
              title: 'Report rats and mice',
              text: 'Rats, mice, and other four-legged pests.',
              target: 'rodentsReport',
              karl: 'Related entry. SF.gov page link.',
            },
          ],
        },
      ],
    }

    const { valid, issues } = validateGeneratedPage(maximal, { rodentsReport: {} })
    expect(issues).toEqual([])
    expect(valid).toBe(true)
  })
})

describe('validateGeneratedPage', () => {
  const minimal = {
    slug: 'sf.gov/test',
    type: 'Information',
    title: 'A short title',
    summary: 'A short summary of the page.',
    audience: ['Someone who needs this'],
    reading: 'Grade 6',
    sections: [{ heading: 'What to do', karl: 'Body block.', paragraphs: ['Call 311 for help.'] }],
  }

  test('stops at the schema layer rather than cascading downstream errors', () => {
    const result = validateGeneratedPage({ title: 'Only a title' })
    expect(result.schemaValid).toBe(false)
    expect(result.valid).toBe(false)
    expect(result.issues.every((issue) => issue.startsWith('Schema:'))).toBe(true)
  })

  test('resolves link targets against the real page-key universe', () => {
    const page = {
      ...minimal,
      sections: [
        { heading: 'Related', karl: 'Related.', cards: [{ title: 'Go there', target: 'realKey' }] },
      ],
    }
    expect(validateGeneratedPage(page, { realKey: {} }).valid).toBe(true)
    expect(validateGeneratedPage(page, {}).issues.join(' ')).toContain('realKey')
  })

  test('does not report pre-existing problems in the repo as the model’s fault', () => {
    // A real page with a broken link must not surface as an issue with the
    // generated draft; only findings on the candidate are reported.
    const brokenExisting = {
      sections: [{ heading: 'x', karl: 'x', cards: [{ title: 'y', target: 'missingKey' }] }],
    }
    expect(validateGeneratedPage(minimal, { brokenExisting }).valid).toBe(true)
  })

  test('applies the Article 11 scope check to Agency pages only', () => {
    const withDbi = {
      ...minimal,
      sections: [
        { heading: 'Scope', karl: 'Body.', paragraphs: ['Contact DBI about roof leak repairs.'] },
      ],
    }
    // Information pages legitimately route residents to DBI.
    expect(validateGeneratedPage({ ...withDbi, type: 'Information' }).valid).toBe(true)
    // The Agency page must stay inside Article 11.
    const agency = validateGeneratedPage({ ...withDbi, type: 'Agency' })
    expect(agency.valid).toBe(false)
    expect(agency.issues.join(' ')).toContain('Out of scope')
  })

  test('reports the list-format invariant that validate.js enforces', () => {
    const page = {
      ...minimal,
      sections: [{ heading: 'What to do', karl: 'Body.', paragraphs: ['One.', 'Two.', 'Three.'] }],
    }
    expect(validateGeneratedPage(page).issues.join(' ')).toContain('must use bullets')
  })

  test('reports plain-language mandates alongside the invariants', () => {
    const page = {
      ...minimal,
      sections: [
        {
          heading: 'What to do',
          karl: 'Body.',
          paragraphs: ['The owner shall fix it. Do not wait.'],
        },
      ],
    }
    expect(validateGeneratedPage(page).issues.join(' ')).toContain('shall')
  })
})

describe('request bounds', () => {
  const request = (page) => generateRequestSchema.safeParse({ task: 'content', prompt: 'x', page })

  test('accepts a request with no page at all', () => {
    const result = generateRequestSchema.safeParse({ task: 'content', prompt: 'x' })
    expect(`no page: ${result.success}`).toBe('no page: true')
  })

  test('accepts every real page in this repo as grounding', () => {
    // The caps exist to stop abuse, not to reject the tool's own content. If
    // this fails, the "use the current page as context" checkbox has silently
    // stopped working for some page.
    const { loadPageData } = require('../build_scripts/load-pages')
    for (const [key, page] of Object.entries(loadPageData().pages)) {
      expect(`${key}: ${request(page).success}`).toBe(`${key}: true`)
    }
  })

  test('rejects a page that serializes past the size cap', () => {
    expect(`oversized: ${request({ filler: 'x'.repeat(200_000) }).success}`).toBe(
      'oversized: false'
    )
  })

  test('rejects a page nested past the depth cap', () => {
    let nested = { end: true }
    for (let i = 0; i < MAX_PAGE_DEPTH + 5; i += 1) nested = { nested }
    expect(`too deep: ${request(nested).success}`).toBe('too deep: false')
  })

  test('rejects a circular page rather than throwing on it', () => {
    const circular = { title: 'Loop' }
    circular.self = circular
    expect(`circular: ${request(circular).success}`).toBe('circular: false')
  })

  test('measures depth without recursing on the input', () => {
    // Deliberately deeper than any call stack would survive recursively: the
    // guard must not be the denial of service it exists to prevent.
    let nested = { end: true }
    for (let i = 0; i < 200_000; i += 1) nested = { nested }
    expect(measureDepth(nested, MAX_PAGE_DEPTH)).toBeGreaterThan(MAX_PAGE_DEPTH)
  })

  test('counts a flat object as depth 1', () => {
    expect(`depth: ${measureDepth({ a: 1, b: 'two' }, MAX_PAGE_DEPTH)}`).toBe('depth: 1')
  })

  test('counts nesting through arrays, not just objects', () => {
    const depth = measureDepth({ sections: [{ steps: [{ title: 'x' }] }] }, MAX_PAGE_DEPTH)
    expect(`depth: ${depth}`).toBe('depth: 5')
  })
})

describe('grounding page size is measured on what is actually sent', () => {
  const { buildContentUserPrompt } = require('../build_scripts/ai/prompts')
  const {
    serializePageForPrompt,
    generateRequestSchema,
    MAX_PAGE_JSON_BYTES,
  } = require('../build_scripts/ai/schemas')

  test('the prompt embeds the exact string the cap measured', () => {
    // The bug this pins: the cap measured compact JSON while the prompt sent
    // the pretty-printed form, so indentation was free and a page could arrive
    // upstream several times larger than the limit it passed.
    const page = { title: 'A page', sections: [{ heading: 'What to do', karl: 'Body.' }] }
    expect(buildContentUserPrompt({ prompt: 'Draft.', page })).toContain(
      serializePageForPrompt(page)
    )
  })

  test('rejects a page whose sent form exceeds the cap even though its compact form does not', () => {
    // Many small nested entries: cheap compact, expensive pretty-printed.
    // Sized so the compact form is comfortably UNDER the cap — that is the
    // whole point, since the old check would have waved this through.
    const page = { rows: Array.from({ length: 2500 }, () => ({ a: [1, 2, 3], b: { c: 1 } })) }
    expect(JSON.stringify(page).length).toBeLessThan(MAX_PAGE_JSON_BYTES)
    expect(serializePageForPrompt(page).length).toBeGreaterThan(MAX_PAGE_JSON_BYTES)
    expect(generateRequestSchema.safeParse({ task: 'content', prompt: 'x', page }).success).toBe(
      false
    )
  })

  test('measures the page cap in UTF-8 bytes, not UTF-16 code units', () => {
    // MAX_PAGE_JSON_BYTES is named in bytes and the request contract is
    // byte-based, but String#length counts UTF-16 units — so multi-byte copy
    // could exceed the cap by roughly 3x. This page is comfortably under the
    // limit by character count and over it by bytes.
    const page = { filler: '€'.repeat(40_000) }
    const sent = serializePageForPrompt(page)
    expect(`chars under cap: ${sent.length < MAX_PAGE_JSON_BYTES}`).toBe('chars under cap: true')
    expect(`bytes over cap: ${Buffer.byteLength(sent, 'utf8') > MAX_PAGE_JSON_BYTES}`).toBe(
      'bytes over cap: true'
    )
    const result = generateRequestSchema.safeParse({ task: 'content', prompt: 'x', page })
    expect(`multibyte rejected: ${result.success}`).toBe('multibyte rejected: false')
  })

  test('every real page still fits once measured the way it is sent', () => {
    // Pretty-printing is only ~1.2x on real page shapes, so tightening the
    // measurement must not start rejecting the tool's own content.
    const { loadPageData } = require('../build_scripts/load-pages')
    for (const [key, page] of Object.entries(loadPageData().pages)) {
      const result = generateRequestSchema.safeParse({ task: 'content', prompt: 'x', page })
      expect(`${key}: ${result.success}`).toBe(`${key}: true`)
    }
  })
})

describe('COMPLIANCE_AUDIT_OUTPUT_SCHEMA', () => {
  test('every finding requires issue, severity, citedChunkIds, and recommendation', () => {
    const findingSchema = COMPLIANCE_AUDIT_OUTPUT_SCHEMA.properties.findings.items
    expect(findingSchema.required).toEqual(['issue', 'severity', 'citedChunkIds', 'recommendation'])
  })

  test('severity is constrained to error, warning, or note', () => {
    const findingSchema = COMPLIANCE_AUDIT_OUTPUT_SCHEMA.properties.findings.items
    expect(findingSchema.properties.severity.enum).toEqual(['error', 'warning', 'note'])
  })
})

describe('generateRequestSchema (discriminated union)', () => {
  const VALID_PAGE_STUB = {
    slug: 'x',
    type: 'Information',
    title: 'X',
    summary: 'X',
    audience: ['a'],
    reading: 'Grade 6',
    sections: [],
  }

  test('rejects a compliance-audit request with no page', () => {
    expect(generateRequestSchema.safeParse({ task: 'compliance-audit' }).success).toBe(false)
  })

  test('accepts a compliance-audit request with only task and page', () => {
    const result = generateRequestSchema.safeParse({
      task: 'compliance-audit',
      page: VALID_PAGE_STUB,
    })
    expect(result.success).toBe(true)
  })

  test('still rejects a content request with no prompt', () => {
    expect(
      generateRequestSchema.safeParse({ task: 'content', page: VALID_PAGE_STUB }).success
    ).toBe(false)
  })
})
