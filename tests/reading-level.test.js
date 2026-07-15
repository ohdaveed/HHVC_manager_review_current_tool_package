const { describe, test, expect } = require('bun:test')
const { loadPageData } = require('../build_scripts/load-pages')
const { fleschKincaidGrade, extractPageBodyText } = require('../build_scripts/reading-level')

describe('load-pages', () => {
  test('discovers all page modules and loads HHVC_DATA', () => {
    const data = loadPageData()
    expect(data.order.length).toBe(19)
    expect(data.pages.pestsTopic).toBeTruthy()
    expect(data.order[0][0]).toBe('pestsTopic')
  })
})

describe('reading-level', () => {
  test('computes a grade for sample page body text', () => {
    const data = loadPageData()
    const page = data.pages.pestsTopic
    const text = extractPageBodyText(page)
    const grade = fleschKincaidGrade(text)
    expect(grade).not.toBeNull()
    expect(grade).toBeGreaterThan(0)
    expect(grade).toBeLessThan(20)
  })
})
