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

function fieldHtml(field) {
  const required = field.required ? ` <span class="required-mark" aria-hidden="true">*</span>` : ''
  const reqAttr = field.required ? 'required' : ''

  if (field.type === 'select') {
    return `
      <div class="form-field">
        <label for="${field.id}">${field.label}${required}</label>
        <select id="${field.id}" name="${field.id}" ${reqAttr}>
          <option value="">Select one</option>
          ${field.options.map((o) => `<option value="${o}">${o}</option>`).join('')}
        </select>
      </div>`
  }

  if (field.type === 'textarea') {
    return `
      <div class="form-field">
        <label for="${field.id}">${field.label}${required}</label>
        <textarea id="${field.id}" name="${field.id}" ${reqAttr}></textarea>
      </div>`
  }

  const extra = field.min ? ` min="${field.min}"` : ''
  return `
    <div class="form-field">
      <label for="${field.id}">${field.label}${required}</label>
      <input id="${field.id}" name="${field.id}" type="${field.type}" ${reqAttr}${extra} />
    </div>`
}

function renderForm() {
  const top = fields.slice(0, 4)
  const middle = fields.slice(4, 8)
  const bottom = fields.slice(8)

  app.innerHTML = `
    <form class="form-card" id="workshopForm" novalidate>
      <p class="form-note">
        This form collects interest for HHVC’s free mosquito education workshop campaign. Submitting
        does not guarantee a scheduled date.
      </p>
      <div class="form-grid two-col">${top.map(fieldHtml).join('')}</div>
      <div class="form-grid two-col">${middle.map(fieldHtml).join('')}</div>
      <div class="form-grid">${bottom.map(fieldHtml).join('')}</div>
      <div class="form-actions">
        <button class="btn" type="submit">Submit workshop request</button>
        <a class="btn secondary" href="/">Back to mockup tool</a>
      </div>
    </form>`
}

function renderSuccess(data) {
  app.innerHTML = `
    <div class="form-success" role="status">
      <h2>Thank you — we received your request</h2>
      <p>
        <strong>${escapeHtml(data.organization)}</strong> is on the list for follow-up. HHVC will contact
        ${escapeHtml(data.contactName)} at ${escapeHtml(data.email)} about workshop availability.
      </p>
      <p style="margin-top:0.75rem">
        <a href="/">Return to the HHVC mockup tool</a>
      </p>
    </div>`
}

function getFormData(form) {
  return Object.fromEntries(new FormData(form).entries())
}

renderForm()

document.getElementById('workshopForm').addEventListener('submit', (event) => {
  event.preventDefault()
  const form = event.currentTarget
  if (!form.reportValidity()) return
  renderSuccess(getFormData(form))
})
