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
  PAGE_TYPES,
  SECTION_COMPONENTS,
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
    const zodComponents = sectionSchema.shape.component.unwrap()._def.values
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
