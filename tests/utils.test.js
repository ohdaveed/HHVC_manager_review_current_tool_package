const { describe, test, expect } = require('bun:test')
const { loadScripts } = require('./helpers/load-scripts')

const ctx = loadScripts(['js/utils.js'])

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
