const app = document.getElementById('app')

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const fields = [
  { id: 'organization', label: 'Organization or school name', type: 'text', required: true },
  { id: 'contactName', label: 'Contact name', type: 'text', required: true },
  { id: 'email', label: 'Email', type: 'email', required: true },
  { id: 'phone', label: 'Phone', type: 'tel', required: true },
  {
    id: 'organizationType',
    label: 'Organization type',
    type: 'select',
    required: true,
    options: [
      'School',
      'Summer camp',
      'Museum or library',
      'Science fair or STEM event',
      'Other youth program',
    ],
  },
  {
    id: 'audienceAge',
    label: 'Audience age range',
    type: 'select',
    required: true,
    options: ['Grades K–2', 'Grades 3–5', 'Grades 6–8', 'Mixed ages'],
  },
  { id: 'groupSize', label: 'Expected group size', type: 'number', required: true, min: 1 },
  { id: 'preferredDates', label: 'Preferred date(s)', type: 'text', required: true },
  { id: 'eventLocation', label: 'Event location or neighborhood', type: 'text', required: true },
  {
    id: 'spaceType',
    label: 'Space type',
    type: 'select',
    required: true,
    options: [
      'Indoor classroom',
      'Indoor multipurpose room',
      'Outdoor covered area',
      'Outdoor open area',
    ],
  },
  {
    id: 'electricity',
    label: 'Electricity available nearby?',
    type: 'select',
    required: true,
    options: ['Yes', 'No', 'Not sure'],
  },
  {
    id: 'notes',
    label: 'Anything else we should know?',
    type: 'textarea',
    required: false,
  },
]

/**
 * Render one field, restoring `values[field.id]` if it is there.
 *
 * The restore is what makes "Back to the form" usable: a reviewer who spots
 * one wrong entry in the preview should not have to retype the other ten to
 * fix it. Every value goes through escapeHtml on the way back into an
 * attribute, since it is the reviewer's own text being re-serialized.
 */
function fieldHtml(field, values = {}) {
  const required = field.required ? ` <span class="required-mark" aria-hidden="true">*</span>` : ''
  const reqAttr = field.required ? 'required' : ''
  const current = values[field.id] ?? ''

  if (field.type === 'select') {
    const options = field.options
      .map(
        (o) => `<option value="${escapeHtml(o)}"${o === current ? ' selected' : ''}>${o}</option>`
      )
      .join('')
    return `
      <div class="form-field">
        <label for="${field.id}">${field.label}${required}</label>
        <select id="${field.id}" name="${field.id}" ${reqAttr}>
          <option value=""${current ? '' : ' selected'}>Select one</option>
          ${options}
        </select>
      </div>`
  }

  if (field.type === 'textarea') {
    return `
      <div class="form-field">
        <label for="${field.id}">${field.label}${required}</label>
        <textarea id="${field.id}" name="${field.id}" ${reqAttr}>${escapeHtml(current)}</textarea>
      </div>`
  }

  const extra = field.min ? ` min="${field.min}"` : ''
  return `
    <div class="form-field">
      <label for="${field.id}">${field.label}${required}</label>
      <input id="${field.id}" name="${field.id}" type="${field.type}" value="${escapeHtml(
        current
      )}" ${reqAttr}${extra} />
    </div>`
}

function renderForm(values = {}) {
  const top = fields.slice(0, 4)
  const middle = fields.slice(4, 8)
  const bottom = fields.slice(8)

  app.innerHTML = `
    <form class="form-card" id="workshopForm" name="mosquito-workshop-request" novalidate>
      <p class="form-note form-mock-banner" role="note">
        <strong>This is a design reference, not a live form.</strong> Nothing you enter is sent or
        stored anywhere. It exists to show what the real intake form needs to capture — HHVC's
        production form will be a Fillout form linked from the campaign page, following how SF.gov
        form pages hand off rather than embed.
      </p>
      <p class="form-note">
        The real form would collect interest for HHVC's free mosquito education workshop campaign.
        Submitting would not guarantee a scheduled date.
      </p>
      <div class="form-grid two-col">${top.map((f) => fieldHtml(f, values)).join('')}</div>
      <div class="form-grid two-col">${middle.map((f) => fieldHtml(f, values)).join('')}</div>
      <div class="form-grid">${bottom.map((f) => fieldHtml(f, values)).join('')}</div>
      <div class="form-actions">
        <button class="btn" type="submit">Preview what this form captures</button>
        <a class="btn secondary" href="/">Back to mockup tool</a>
      </div>
    </form>`
}

function renderSummary(data) {
  // A design reference is most useful when it shows what the real form has to
  // carry, so submitting renders the captured payload rather than pretending
  // to send it. The heading says NOT SUBMITTED first, because the one thing
  // this page must never imply is that somebody's request was received.
  const rows = fields
    .map((field) => {
      const value = (data[field.id] ?? '').trim()
      return `<tr><th scope="row">${escapeHtml(field.label)}</th><td>${
        value ? escapeHtml(value) : '<em>(left blank)</em>'
      }</td></tr>`
    })
    .join('')

  app.innerHTML = `
    <div class="form-success" role="status">
      <h2>Not submitted — this is what the real form would capture</h2>
      <p>
        No request was sent and nothing was stored. This preview exists so reviewers can check the
        field list against what HHVC actually needs before the production Fillout form is built.
      </p>
      <table class="form-summary">
        <caption class="visually-hidden">Field values entered in this preview</caption>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:0.75rem">
        <button class="btn secondary" type="button" id="backToForm">Back to the form</button>
        <a href="/">Return to the HHVC mockup tool</a>
      </p>
    </div>`

  document.getElementById('backToForm').addEventListener('click', () => {
    renderForm(data)
    attachSubmitHandler()
  })
}

function getFormData(form) {
  return Object.fromEntries(new FormData(form).entries())
}

renderForm()
attachSubmitHandler()

/**
 * Validate, then show what was captured. There is deliberately no network
 * call: this form has no intake backend on any deploy, and the version that
 * POSTed to "/" by the Netlify Forms convention rendered a confirmation for
 * every silently discarded submission once Netlify was retired. The server
 * answers 405 for that POST now, which made the failure visible — but a form
 * that always fails reads as broken rather than as a mock, so it no longer
 * asks at all.
 */
function attachSubmitHandler() {
  const form = document.getElementById('workshopForm')
  if (!form) return
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (!form.reportValidity()) return
    renderSummary(getFormData(form))
  })
}
