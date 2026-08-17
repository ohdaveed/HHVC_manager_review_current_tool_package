import { showToast } from './ui-controls.js'

function setExpanded(trigger, expanded) {
  const panelId = trigger.getAttribute('aria-controls')
  const panel = panelId ? document.getElementById(panelId) : null
  if (!panel) return
  trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false')
  panel.hidden = !expanded
}

async function copyValue(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
  } else {
    const input = document.createElement('textarea')
    input.value = value
    input.setAttribute('readonly', '')
    input.className = 'karl-copy-fallback'
    document.body.append(input)
    input.select()
    document.execCommand('copy')
    input.remove()
  }
  showToast('Karl value copied', 'success')
}

function initKarlGuides() {
  if (window.karlGuide?.ready) return
  document.addEventListener('click', (event) => {
    const copy = event.target.closest('[data-karl-copy]')
    if (copy) {
      event.preventDefault()
      event.stopPropagation()
      copyValue(copy.getAttribute('data-karl-copy') || '').catch(() =>
        showToast('Copy failed', 'error')
      )
      return
    }
    const trigger = event.target.closest('.karl-guide-trigger')
    if (!trigger) return
    event.preventDefault()
    event.stopPropagation()
    setExpanded(trigger, trigger.getAttribute('aria-expanded') !== 'true')
  })
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    const trigger = event.target.closest('.karl-guide-trigger')
    if (!trigger || trigger.getAttribute('aria-expanded') !== 'true') return
    setExpanded(trigger, false)
    trigger.focus()
  })
  window.karlGuide = { ready: true, setExpanded }
}

initKarlGuides()
